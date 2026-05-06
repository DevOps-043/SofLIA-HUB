/**
 * Builders que mezclan datos remotos con estado local pendiente.
 *
 * Centraliza la lógica de "qué ve el usuario": remoto + pending - eliminados.
 * Útil para mantener consistencia entre el flujo online (loadConversations) y
 * el offline (buildLocalConversationList).
 */

import { loadConversationsFromCache, loadMessagesFromCache, saveConversationsToCache, saveMessagesToCache } from './cache';
import { dedupeConversations, dedupeMessages } from './normalize';
import {
  getDeletedConversationIds,
  getPendingConversationUpserts,
  getPendingMessageSnapshot,
} from './pending-state';
import type { ChatMessage, Conversation } from './types';

export function buildConversationList(
  userId: string,
  remoteConversations: Conversation[],
): Conversation[] {
  const deleted = getDeletedConversationIds(userId);
  const merged = dedupeConversations([
    ...remoteConversations,
    ...getPendingConversationUpserts(userId),
  ]).filter((conversation) => !deleted.has(conversation.id));

  saveConversationsToCache(userId, merged);
  return merged;
}

export function buildLocalConversationList(userId: string): Conversation[] {
  const cached = loadConversationsFromCache(userId);
  const deleted = getDeletedConversationIds(userId);

  return dedupeConversations([
    ...cached,
    ...getPendingConversationUpserts(userId),
  ]).filter((conversation) => !deleted.has(conversation.id));
}

export function buildMessageList(
  userId: string,
  conversationId: string,
  remoteMessages: ChatMessage[],
): ChatMessage[] {
  const merged = dedupeMessages([
    ...remoteMessages,
    ...getPendingMessageSnapshot(userId, conversationId),
  ]);

  saveMessagesToCache(conversationId, merged);
  return merged;
}

export function buildLocalMessageList(userId: string, conversationId: string): ChatMessage[] {
  return dedupeMessages([
    ...loadMessagesFromCache(conversationId),
    ...getPendingMessageSnapshot(userId, conversationId),
  ]);
}
