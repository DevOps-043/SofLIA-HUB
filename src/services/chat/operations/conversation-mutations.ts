import { removeConversationFromAllCaches, saveConversationToCache, updateConversationInCache } from '../cache';
import { normalizeConversation } from '../normalize';
import {
  purgeConversationFromAllPendingStates,
  queueConversationDelete,
  queueConversationUpsert,
} from '../pending-state';
import { syncPendingChatState } from '../sync';
import { recordConversationTombstoneForAllIdentities } from '../tombstones';
import type { Conversation } from '../types';

export async function createConversation(userId: string, title: string, folderId?: string, orgId?: string): Promise<Conversation | null> {
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
  const { loadConversationsFromCache } = await import('../cache');
  return normalizeConversation(loadConversationsFromCache(userId).find((item) => item.id === conversation.id) || conversation);
}

export async function deleteConversation(userId: string, conversationId: string): Promise<boolean> {
  // La lapida se escribe ANTES de tocar remoto: si el borrado falla o la app se
  // cierra a mitad, la conversacion queda oculta y en cola de reintento, nunca
  // revivida por el cache ni por la migracion de identidad.
  recordConversationTombstoneForAllIdentities(userId, conversationId);
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

export async function updateConversationTitle(userId: string, conversationId: string, title: string): Promise<void> {
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

export async function toggleConversationPin(userId: string, conversationId: string, isPinned: boolean): Promise<void> {
  const updated = updateConversationInCache(userId, conversationId, (conversation) => ({
    ...conversation,
    is_pinned: isPinned,
    updated_at: new Date().toISOString(),
  }));
  if (!updated) return;

  queueConversationUpsert(userId, updated);
  try {
    await syncPendingChatState(userId, [conversationId]);
  } catch (err) {
    console.error('[chat-service] toggleConversationPin sync exception:', err);
  }
}
