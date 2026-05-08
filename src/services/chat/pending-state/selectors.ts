import { dedupeConversations, dedupeMessages } from '../normalize';
import type { ChatMessage, Conversation } from '../types';
import { readPendingChatState } from './state-store';

export function getPendingConversationUpserts(userId: string): Conversation[] {
  return dedupeConversations(Object.values(readPendingChatState(userId).conversationUpserts));
}

export function getPendingMessageSnapshot(
  userId: string,
  conversationId: string,
): ChatMessage[] {
  return dedupeMessages(readPendingChatState(userId).messageSnapshots[conversationId] || []);
}

export function getDeletedConversationIds(userId: string): Set<string> {
  return new Set(readPendingChatState(userId).deletedConversationIds);
}
