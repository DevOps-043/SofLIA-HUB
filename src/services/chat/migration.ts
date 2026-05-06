/**
 * Migración de caché entre identidades de usuario.
 *
 * Se ejecuta una sola vez por sesión cuando el usuario activo cambia (p.ej.
 * tras cerrar sesión y entrar con otra cuenta), para preservar conversaciones
 * que estuvieran cacheadas bajo la identidad anterior.
 */

import {
  getConversationCacheKey,
  getPendingChatStateKey,
  loadConversationsFromCache,
  saveConversationsToCache,
} from './cache';
import { normalizeConversation } from './normalize';
import { readPendingChatState, writePendingChatState } from './pending-state';
import type { PendingChatState } from './types';

export function migrateLegacyChatCache(sourceUserId: string, targetUserId: string): void {
  if (!sourceUserId || !targetUserId || sourceUserId === targetUserId) {
    return;
  }

  const sourceConversations = loadConversationsFromCache(sourceUserId).map((conversation) =>
    normalizeConversation({ ...conversation, user_id: targetUserId }),
  );
  const targetConversations = loadConversationsFromCache(targetUserId);

  if (sourceConversations.length > 0) {
    saveConversationsToCache(targetUserId, [...targetConversations, ...sourceConversations]);
    try {
      localStorage.removeItem(getConversationCacheKey(sourceUserId));
    } catch {
      /* localStorage no disponible — aceptable, la app funciona */
    }
  }

  const sourcePending = readPendingChatState(sourceUserId);
  const targetPending = readPendingChatState(targetUserId);

  const migratedUpserts = Object.fromEntries(
    Object.values(sourcePending.conversationUpserts).map((conversation) => [
      conversation.id,
      normalizeConversation({ ...conversation, user_id: targetUserId }),
    ]),
  );

  const merged: PendingChatState = {
    conversationUpserts: { ...targetPending.conversationUpserts, ...migratedUpserts },
    messageSnapshots: { ...targetPending.messageSnapshots, ...sourcePending.messageSnapshots },
    deletedConversationIds: Array.from(
      new Set([...targetPending.deletedConversationIds, ...sourcePending.deletedConversationIds]),
    ),
  };

  const hasEntries =
    Object.keys(merged.conversationUpserts).length > 0 ||
    Object.keys(merged.messageSnapshots).length > 0 ||
    merged.deletedConversationIds.length > 0;

  if (hasEntries) {
    writePendingChatState(targetUserId, merged);
    try {
      localStorage.removeItem(getPendingChatStateKey(sourceUserId));
    } catch {
      /* mismo motivo */
    }
  }
}
