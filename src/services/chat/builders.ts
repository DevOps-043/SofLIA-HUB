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
import { getConversationTombstones } from './tombstones';
import type { ChatMessage, Conversation } from './types';

/**
 * Lo borrado son tres cosas: la marca `deleted_at` que llega de Supabase (la
 * unica que viaja entre equipos), la cola de borrados pendientes (se limpia al
 * sincronizar) y las lapidas durables (no se limpian). Se cruzan las tres para
 * que una conversacion que sobrevivio en Supabase no vuelva a la interfaz.
 */
function deletedConversationIds(userId: string): Set<string> {
  const deleted = getConversationTombstones(userId);
  for (const id of getDeletedConversationIds(userId)) deleted.add(id);
  return deleted;
}

export function buildConversationList(
  userId: string,
  remoteConversations: Conversation[],
): Conversation[] {
  const deleted = deletedConversationIds(userId);
  const merged = dedupeConversations([
    ...remoteConversations,
    ...getPendingConversationUpserts(userId),
  ]).filter((conversation) => !deleted.has(conversation.id) && !conversation.deleted_at);

  saveConversationsToCache(userId, merged);
  return merged;
}

export function buildLocalConversationList(userId: string): Conversation[] {
  const cached = loadConversationsFromCache(userId);
  const deleted = deletedConversationIds(userId);

  return dedupeConversations([
    ...cached,
    ...getPendingConversationUpserts(userId),
  ]).filter((conversation) => !deleted.has(conversation.id) && !conversation.deleted_at);
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
