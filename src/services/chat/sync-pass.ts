import { getConversationCacheKey, getMessageCacheKey, loadConversationsFromCache, loadMessagesFromCache, saveConversationToCache, saveMessagesToCache } from './cache';
import { captureCacheReview } from './cache/review';
import { clearPendingConversationDelete, clearPendingConversationUpsert, clearPendingMessageSnapshot, getPendingConversationUpserts, isCurrentConversationDelete, isCurrentConversationUpsert, isCurrentMessageSnapshot, readPendingChatState } from './pending-state';
import { deleteConversationRemote } from './remote';
import { upsertConversationRemoteOutcome } from './remote/conversation-mutations';
import { syncMessagesRemoteOutcome } from './remote/message-sync';
import { isConversationTombstoned } from './tombstones';
import type { ChatSessionLease } from './session-review';

/** Una pasada con alcance fijo; el coordinador conserva solicitudes posteriores. */
export async function runPendingChatSyncPass(userId: string, targetIds: Set<string> | null, session: ChatSessionLease): Promise<void> {
  if (!session.isCurrent()) return;
  const included = (id: string) => targetIds === null || targetIds.has(id);
  for (const id of readPendingChatState(userId).deletedConversationIds) {
    if (!session.isCurrent()) return;
    if (!included(id) || !isCurrentConversationDelete(userId, id)) continue;
    const deleted = await deleteConversationRemote(id);
    if (!session.isCurrent()) return;
    if (deleted) clearPendingConversationDelete(userId, id);
  }
  for (const pending of getPendingConversationUpserts(userId)) {
    if (!session.isCurrent()) return;
    const id = pending.id;
    if (!included(id) || !isCurrentConversationUpsert(userId, pending)) continue;
    if (isConversationTombstoned(userId, id) || (pending.user_id && pending.user_id !== userId)) {
      if (clearPendingConversationUpsert(userId, id, pending)) console.warn('[chat-service] Se descartó una conversación revocada o de otra identidad.');
      continue;
    }
    const cacheCurrent = captureCacheReview(getConversationCacheKey(userId), pending, () => loadConversationsFromCache(userId).find(entry => entry.id === id));
    const result = await upsertConversationRemoteOutcome(pending);
    if (!session.isCurrent()) return;
    if (!isCurrentConversationUpsert(userId, pending) || isConversationTombstoned(userId, id)) continue;
    if (!result.ok) {
      if (result.permanente && clearPendingConversationUpsert(userId, id, pending)) console.warn('[chat-service] Se retiró de la cola una conversación rechazada permanentemente; se conserva su copia local.');
      continue;
    }
    if (clearPendingConversationUpsert(userId, id, pending) && cacheCurrent()) {
      saveConversationToCache(userId, { ...result.data,
        is_shared: pending.is_shared, share_permission: pending.share_permission,
        can_edit: pending.can_edit, can_share: pending.can_share, shared_by_user_id: pending.shared_by_user_id,
        share_token: pending.share_token, shared_at: pending.shared_at });
    }
  }
  for (const [id, snapshot] of Object.entries(readPendingChatState(userId).messageSnapshots)) {
    if (!session.isCurrent()) return;
    if (!included(id) || !isCurrentMessageSnapshot(userId, id, snapshot)) continue;
    if (isConversationTombstoned(userId, id)) { clearPendingMessageSnapshot(userId, id, snapshot); continue; }
    const cacheCurrent = captureCacheReview(getMessageCacheKey(id), snapshot, () => loadMessagesFromCache(id));
    const result = await syncMessagesRemoteOutcome(id, userId, snapshot);
    if (!session.isCurrent()) return;
    if (!isCurrentMessageSnapshot(userId, id, snapshot) || isConversationTombstoned(userId, id)) continue;
    if ((result.ok || result.permanente) && clearPendingMessageSnapshot(userId, id, snapshot)) {
      if (cacheCurrent()) saveMessagesToCache(id, snapshot);
      if (!result.ok) console.warn('[chat-service] Se retiraron de la cola mensajes rechazados permanentemente; se conserva su copia local.');
    }
  }
}
