import { CACHE_KEYS } from '../cache';
import { readPendingChatState, writePendingChatState } from './state-store';

export function purgeConversationFromAllPendingStates(conversationId: string): void {
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key || !key.startsWith(CACHE_KEYS.PENDING_PREFIX)) continue;

      const userId = key.slice(CACHE_KEYS.PENDING_PREFIX.length);
      if (!userId) continue;

      const state = readPendingChatState(userId);
      const nextUpserts = { ...state.conversationUpserts };
      const nextSnapshots = { ...state.messageSnapshots };
      delete nextUpserts[conversationId];
      delete nextSnapshots[conversationId];

      writePendingChatState(userId, {
        conversationUpserts: nextUpserts,
        messageSnapshots: nextSnapshots,
        deletedConversationIds: state.deletedConversationIds.filter((id) => id !== conversationId),
      });
    }
  } catch {
    // No bloquear borrados por errores de storage local.
  }
}
