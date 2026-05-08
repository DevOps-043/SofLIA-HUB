import { dedupeConversations, normalizeConversation } from '../normalize';
import type { Conversation } from '../types';
import { getConversationCacheKey } from './keys';

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
    localStorage.setItem(getConversationCacheKey(userId), JSON.stringify(dedupeConversations(conversations)));
  } catch {
    // localStorage lleno o no disponible: el caller puede recargar de Supabase.
  }
}

export function updateConversationCache(
  userId: string,
  updater: (conversations: Conversation[]) => Conversation[],
): void {
  const current = loadConversationsFromCache(userId);
  saveConversationsToCache(userId, updater(current));
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
      if (conversation.id !== conversationId) return conversation;
      updated = normalizeConversation(updater(conversation));
      return updated;
    }),
  );

  return updated;
}
