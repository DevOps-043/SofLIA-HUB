const CONVERSATIONS_CACHE_KEY = 'lia_conversations';
const MESSAGE_CACHE_PREFIX = 'lia_messages_';
const PENDING_CHAT_STATE_PREFIX = 'lia_pending_chat_state_';
const DELETED_CONVERSATIONS_PREFIX = 'lia_deleted_conversations_';

export const CACHE_KEYS = Object.freeze({
  CONVERSATIONS_PREFIX: `${CONVERSATIONS_CACHE_KEY}_`,
  MESSAGES_PREFIX: MESSAGE_CACHE_PREFIX,
  PENDING_PREFIX: PENDING_CHAT_STATE_PREFIX,
  DELETED_PREFIX: DELETED_CONVERSATIONS_PREFIX,
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

export function getDeletedConversationsKey(userId: string): string {
  return `${DELETED_CONVERSATIONS_PREFIX}${userId}`;
}
