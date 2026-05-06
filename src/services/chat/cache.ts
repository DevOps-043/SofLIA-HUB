/**
 * Capa de caché local en `localStorage`.
 *
 * Aísla las operaciones contra el storage del navegador para que el resto del
 * paquete no tenga que conocer el formato ni las claves. Si en el futuro
 * cambiamos a IndexedDB o a un storage nativo de Electron, solo este archivo
 * cambia.
 */

import { dedupeConversations, dedupeMessages, normalizeConversation } from './normalize';
import type { ChatMessage, Conversation } from './types';

const CONVERSATIONS_CACHE_KEY = 'lia_conversations';
const MESSAGE_CACHE_PREFIX = 'lia_messages_';
const PENDING_CHAT_STATE_PREFIX = 'lia_pending_chat_state_';

export const CACHE_KEYS = Object.freeze({
  CONVERSATIONS_PREFIX: `${CONVERSATIONS_CACHE_KEY}_`,
  MESSAGES_PREFIX: MESSAGE_CACHE_PREFIX,
  PENDING_PREFIX: PENDING_CHAT_STATE_PREFIX,
});

export function getConversationCacheKey(userId: string): string {
  return `${CONVERSATIONS_CACHE_KEY}_${userId}`;
}

export function getMessageCacheKey(conversationId: string): string {
  return `${MESSAGE_CACHE_PREFIX}${conversationId}`;
}

export function getPendingChatStateKey(userId: string): string {
  return `${PENDING_CHAT_STATE_PREFIX}${userId}`;
}

export function loadConversationsFromCache(userId: string): Conversation[] {
  try {
    const cached = localStorage.getItem(getConversationCacheKey(userId));
    return cached ? dedupeConversations(JSON.parse(cached)) : [];
  } catch {
    return [];
  }
}

export function saveConversationsToCache(userId: string, conversations: Conversation[]): void {
  try {
    localStorage.setItem(
      getConversationCacheKey(userId),
      JSON.stringify(dedupeConversations(conversations)),
    );
  } catch {
    /* localStorage lleno o no disponible — degradación silenciosa aceptable: el caller siempre puede recargar de Supabase */
  }
}

export function updateConversationCache(
  userId: string,
  updater: (conversations: Conversation[]) => Conversation[],
): void {
  const current = loadConversationsFromCache(userId);
  saveConversationsToCache(userId, updater(current));
}

export function loadMessagesFromCache(conversationId: string): ChatMessage[] {
  try {
    const cached = localStorage.getItem(getMessageCacheKey(conversationId));
    return cached ? dedupeMessages(JSON.parse(cached)) : [];
  } catch {
    return [];
  }
}

export function saveMessagesToCache(conversationId: string, messages: ChatMessage[]): void {
  try {
    localStorage.setItem(
      getMessageCacheKey(conversationId),
      JSON.stringify(dedupeMessages(messages)),
    );
  } catch {
    /* ver nota arriba */
  }
}

export function saveConversationToCache(userId: string, conversation: Conversation): void {
  updateConversationCache(userId, (conversations) => {
    const next = conversations.filter((item) => item.id !== conversation.id);
    next.unshift(normalizeConversation(conversation));
    return next;
  });
}

export function updateConversationInCache(
  userId: string,
  conversationId: string,
  updater: (conversation: Conversation) => Conversation,
): Conversation | null {
  let updated: Conversation | null = null;

  updateConversationCache(userId, (conversations) =>
    conversations.map((conversation) => {
      if (conversation.id !== conversationId) {
        return conversation;
      }
      updated = normalizeConversation(updater(conversation));
      return updated;
    }),
  );

  return updated;
}

/**
 * Borra una conversación de TODOS los caches en localStorage (incluso de
 * usuarios distintos al actual). Necesario porque las conversaciones
 * compartidas pueden estar en el caché de varios userIds.
 */
export function removeConversationFromAllCaches(conversationId: string): void {
  try {
    localStorage.removeItem(getMessageCacheKey(conversationId));

    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key) continue;

      if (key.startsWith(CACHE_KEYS.CONVERSATIONS_PREFIX)) {
        const raw = localStorage.getItem(key);
        if (!raw) continue;

        const filtered = dedupeConversations(JSON.parse(raw)).filter(
          (conversation) => conversation.id !== conversationId,
        );
        localStorage.setItem(key, JSON.stringify(filtered));
      }
    }
  } catch {
    /* errores aquí no deben bloquear la operación de borrado en remoto */
  }
}
