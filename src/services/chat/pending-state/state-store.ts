import { getPendingChatStateKey } from '../cache';
import { dedupeMessages, normalizeConversation } from '../normalize';
import type { ChatMessage, PendingChatState } from '../types';

function emptyPendingChatState(): PendingChatState {
  return {
    conversationUpserts: {},
    messageSnapshots: {},
    deletedConversationIds: [],
  };
}

export function readPendingChatState(userId: string): PendingChatState {
  try {
    const raw = localStorage.getItem(getPendingChatStateKey(userId));
    if (!raw) return emptyPendingChatState();

    const parsed = JSON.parse(raw);
    const state: PendingChatState = emptyPendingChatState();

    for (const conversation of Object.values(parsed?.conversationUpserts || {})) {
      const normalized = normalizeConversation(conversation as Record<string, unknown>);
      state.conversationUpserts[normalized.id] = normalized;
    }

    for (const [conversationId, messages] of Object.entries(parsed?.messageSnapshots || {})) {
      state.messageSnapshots[conversationId] = dedupeMessages((messages || []) as ChatMessage[]);
    }

    state.deletedConversationIds = Array.from(
      new Set((parsed?.deletedConversationIds || []).filter((id: unknown) => typeof id === 'string')),
    );

    return state;
  } catch {
    return emptyPendingChatState();
  }
}

export function writePendingChatState(userId: string, state: PendingChatState): void {
  try {
    const hasEntries =
      Object.keys(state.conversationUpserts).length > 0 ||
      Object.keys(state.messageSnapshots).length > 0 ||
      state.deletedConversationIds.length > 0;

    if (!hasEntries) {
      localStorage.removeItem(getPendingChatStateKey(userId));
      return;
    }

    localStorage.setItem(getPendingChatStateKey(userId), JSON.stringify(state));
  } catch {
    // Degradacion silenciosa: el sync se reintentara en una proxima sesion.
  }
}

export function updatePendingChatState(
  userId: string,
  updater: (state: PendingChatState) => PendingChatState,
): PendingChatState {
  const next = updater(readPendingChatState(userId));
  writePendingChatState(userId, next);
  return next;
}
