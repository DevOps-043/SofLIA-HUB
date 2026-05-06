/**
 * Operaciones de alto nivel — la API pública del paquete chat.
 *
 * Cada función orquesta varias capas (cache + remote + pending state + recovery)
 * pero NO contiene lógica de bajo nivel: delega a los módulos especializados.
 * Esto las hace fáciles de leer y de instrumentar (p.ej. agregar telemetría
 * o logging por operación sin tocar las capas internas).
 */

import {
  loadMessagesFromCache,
  removeConversationFromAllCaches,
  saveConversationToCache,
  saveMessagesToCache,
  updateConversationInCache,
} from './cache';
import {
  buildConversationList,
  buildLocalConversationList,
  buildLocalMessageList,
  buildMessageList,
} from './builders';
import { dedupeMessages, isPersistableMessage, normalizeConversation } from './normalize';
import {
  getPendingMessageSnapshot,
  purgeConversationFromAllPendingStates,
  queueConversationDelete,
  queueConversationUpsert,
  queueMessageSnapshot,
} from './pending-state';
import {
  recoverPendingConversationsFromCache,
  recoverPendingMessagesFromCache,
} from './recovery';
import { fetchAccessibleConversations } from './remote';
import { supabase } from '../../lib/supabase';
import { syncPendingChatState } from './sync';
import type { ChatMessage, Conversation } from './types';

/**
 * Serializa los saves por conversación para evitar carreras donde dos llamadas
 * paralelas a saveMessages pisan el orden de upsert en Supabase.
 */
const saveChainByConversation = new Map<string, Promise<void>>();

export async function loadConversations(
  userId: string,
  orgId?: string,
  accessUserIds?: string[],
): Promise<Conversation[]> {
  if (!userId) return [];

  // Procesar pending state ANTES del fetch para que los upserts locales
  // aparezcan en el resultado remoto.
  await syncPendingChatState(userId);

  try {
    let remote = await fetchAccessibleConversations(
      userId,
      accessUserIds && accessUserIds.length > 0 ? accessUserIds : [userId],
      orgId,
    );

    const recovered = recoverPendingConversationsFromCache(
      userId,
      new Set(remote.map((c) => c.id)),
    );

    if (recovered.length > 0) {
      await syncPendingChatState(userId, recovered);

      try {
        remote = await fetchAccessibleConversations(
          userId,
          accessUserIds && accessUserIds.length > 0 ? accessUserIds : [userId],
          orgId,
        );
      } catch {
        // Si el segundo fetch falla, fusionar lo que ya tenemos con el caché local.
        const { loadConversationsFromCache } = await import('./cache');
        remote = [...remote, ...loadConversationsFromCache(userId)];
      }
    }

    return buildConversationList(userId, remote);
  } catch (err) {
    console.error('[chat-service] loadConversations exception:', err);
    return buildLocalConversationList(userId);
  }
}

export async function loadMessages(conversationId: string, userId?: string): Promise<ChatMessage[]> {
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[chat-service] loadMessages FAILED:', error.message, '| code:', error.code);
      return userId
        ? buildLocalMessageList(userId, conversationId)
        : loadMessagesFromCache(conversationId);
    }

    let remote: ChatMessage[] = dedupeMessages(
      (data || []).map((message: Record<string, unknown>) => ({
        id: message.id as string,
        role: message.role as 'user' | 'model',
        text: message.content as string,
        timestamp: new Date(message.created_at as string).getTime(),
        sources: (message.metadata as { sources?: ChatMessage['sources'] })?.sources,
        images: (message.metadata as { images?: ChatMessage['images'] })?.images,
        feedback: (message.metadata as { feedback?: ChatMessage['feedback'] })?.feedback,
      })),
    );

    if (userId && recoverPendingMessagesFromCache(userId, conversationId, remote)) {
      await syncPendingChatState(userId, [conversationId]);
      remote = dedupeMessages([...remote, ...loadMessagesFromCache(conversationId)]);
    }

    if (!userId) {
      saveMessagesToCache(conversationId, remote);
      return remote;
    }

    return buildMessageList(userId, conversationId, remote);
  } catch (err) {
    console.error('[chat-service] loadMessages exception:', err);
    return userId
      ? buildLocalMessageList(userId, conversationId)
      : loadMessagesFromCache(conversationId);
  }
}

export async function createConversation(
  userId: string,
  title: string,
  folderId?: string,
  orgId?: string,
): Promise<Conversation | null> {
  if (!userId) return null;

  const now = new Date().toISOString();
  const conversation: Conversation = {
    id: crypto.randomUUID(),
    user_id: userId,
    title: title.trim() || 'Nueva conversacion',
    folder_id: folderId || undefined,
    org_id: orgId || undefined,
    is_pinned: false,
    created_at: now,
    updated_at: now,
  };

  saveConversationToCache(userId, conversation);
  queueConversationUpsert(userId, conversation);
  await syncPendingChatState(userId, [conversation.id]);

  const { loadConversationsFromCache } = await import('./cache');
  return normalizeConversation(
    loadConversationsFromCache(userId).find((item) => item.id === conversation.id) || conversation,
  );
}

export async function saveMessages(
  conversationId: string,
  userId: string,
  messages: ChatMessage[],
): Promise<void> {
  const validMessages = dedupeMessages(
    messages.filter((message) => !message.id.startsWith('error-') && isPersistableMessage(message)),
  );

  saveMessagesToCache(conversationId, validMessages);

  if (validMessages.length === 0) return;

  // Encadenar saves por conversación para garantizar orden.
  const previous = saveChainByConversation.get(conversationId) || Promise.resolve();
  const chain = previous
    .catch(() => undefined)
    .then(async () => {
      const updated = updateConversationInCache(userId, conversationId, (conversation) => ({
        ...conversation,
        updated_at: new Date().toISOString(),
      }));

      if (updated) {
        queueConversationUpsert(userId, updated);
      }

      queueMessageSnapshot(userId, conversationId, validMessages);

      try {
        await syncPendingChatState(userId, [conversationId]);
      } catch (err) {
        console.error('[chat-service] saveMessages sync exception:', err);
      }
    })
    .finally(() => {
      if (saveChainByConversation.get(conversationId) === chain) {
        saveChainByConversation.delete(conversationId);
      }
    });

  saveChainByConversation.set(conversationId, chain);
  await chain;
}

export async function deleteConversation(userId: string, conversationId: string): Promise<boolean> {
  removeConversationFromAllCaches(conversationId);
  purgeConversationFromAllPendingStates(conversationId);

  if (userId) {
    queueConversationDelete(userId, conversationId);
    try {
      await syncPendingChatState(userId, [conversationId]);
    } catch (err) {
      console.error('[chat-service] deleteConversation sync exception:', err);
    }
  }

  return true;
}

export async function updateConversationTitle(
  userId: string,
  conversationId: string,
  title: string,
): Promise<void> {
  const trimmed = title.trim();
  if (!trimmed) return;

  const updated = updateConversationInCache(userId, conversationId, (conversation) => ({
    ...conversation,
    title: trimmed,
    updated_at: new Date().toISOString(),
  }));

  if (!updated) return;

  queueConversationUpsert(userId, updated);

  try {
    await syncPendingChatState(userId, [conversationId]);
  } catch (err) {
    console.error('[chat-service] updateConversationTitle sync exception:', err);
  }
}

/**
 * Genera un título corto a partir del primer mensaje del usuario.
 * Pure function — sin efectos.
 */
export function generateTitle(messages: ChatMessage[]): string {
  const firstUserMessage = messages.find((message) => message.role === 'user');
  if (firstUserMessage) {
    const text = firstUserMessage.text.trim();
    return text.length > 40 ? `${text.slice(0, 40)}...` : text;
  }
  return 'Nueva conversacion';
}

// Reexports puntuales que el resto del paquete necesita
export { getPendingMessageSnapshot };
