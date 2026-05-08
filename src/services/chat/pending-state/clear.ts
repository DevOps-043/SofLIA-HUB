import { updatePendingChatState } from './state-store';

export function clearPendingConversationUpsert(userId: string, conversationId: string): void {
  updatePendingChatState(userId, (state) => {
    const next = { ...state.conversationUpserts };
    delete next[conversationId];
    return { ...state, conversationUpserts: next };
  });
}

export function clearPendingMessageSnapshot(userId: string, conversationId: string): void {
  updatePendingChatState(userId, (state) => {
    const next = { ...state.messageSnapshots };
    delete next[conversationId];
    return { ...state, messageSnapshots: next };
  });
}

export function clearPendingConversationDelete(userId: string, conversationId: string): void {
  updatePendingChatState(userId, (state) => ({
    ...state,
    deletedConversationIds: state.deletedConversationIds.filter((id) => id !== conversationId),
  }));
}
