import { dedupeMessages, normalizeConversation } from '../normalize';
import type { ChatMessage, Conversation } from '../types';
import { updatePendingChatState } from './state-store';

export function queueConversationUpsert(userId: string, conversation: Conversation): void {
  updatePendingChatState(userId, (state) => ({
    ...state,
    conversationUpserts: {
      ...state.conversationUpserts,
      [conversation.id]: normalizeConversation(conversation),
    },
    deletedConversationIds: state.deletedConversationIds.filter((id) => id !== conversation.id),
  }));
}

export function queueMessageSnapshot(
  userId: string,
  conversationId: string,
  messages: ChatMessage[],
): void {
  updatePendingChatState(userId, (state) => ({
    ...state,
    messageSnapshots: {
      ...state.messageSnapshots,
      [conversationId]: dedupeMessages(messages),
    },
    deletedConversationIds: state.deletedConversationIds.filter((id) => id !== conversationId),
  }));
}

export function queueConversationDelete(userId: string, conversationId: string): void {
  updatePendingChatState(userId, (state) => {
    const nextUpserts = { ...state.conversationUpserts };
    const nextSnapshots = { ...state.messageSnapshots };
    delete nextUpserts[conversationId];
    delete nextSnapshots[conversationId];

    return {
      conversationUpserts: nextUpserts,
      messageSnapshots: nextSnapshots,
      deletedConversationIds: Array.from(new Set([...state.deletedConversationIds, conversationId])),
    };
  });
}
