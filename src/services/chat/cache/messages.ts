import { dedupeMessages } from '../normalize';
import type { ChatMessage } from '../types';
import { getMessageCacheKey } from './keys';

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
    localStorage.setItem(getMessageCacheKey(conversationId), JSON.stringify(dedupeMessages(messages)));
  } catch {
    // Ver nota de conversations cache.
  }
}
