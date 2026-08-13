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
import { getConversationTombstones, recordConversationTombstone } from './tombstones';
import type { PendingChatState } from './types';

export function migrateLegacyChatCache(sourceUserId: string, targetUserId: string): void {
  if (!sourceUserId || !targetUserId || sourceUserId === targetUserId) {
    return;
  }

  // Nunca se arrastra lo borrado: reetiquetar una conversacion con el id de la
  // identidad activa la volvia a subir a Supabase como propia.
  const tombstoned = new Set([
    ...getConversationTombstones(sourceUserId),
    ...getConversationTombstones(targetUserId),
  ]);
  const migrable = (conversationId: string) => !tombstoned.has(conversationId);

  const sourceConversations = loadConversationsFromCache(sourceUserId)
    .filter((conversation) => migrable(conversation.id))
    .map((conversation) => normalizeConversation({ ...conversation, user_id: targetUserId }));
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
    Object.values(sourcePending.conversationUpserts)
      .filter((conversation) => migrable(conversation.id))
      .map((conversation) => [
        conversation.id,
        normalizeConversation({ ...conversation, user_id: targetUserId }),
      ]),
  );
  const migratedSnapshots = Object.fromEntries(
    Object.entries(sourcePending.messageSnapshots).filter(([conversationId]) => migrable(conversationId)),
  );

  const merged: PendingChatState = {
    conversationUpserts: { ...targetPending.conversationUpserts, ...migratedUpserts },
    messageSnapshots: { ...targetPending.messageSnapshots, ...migratedSnapshots },
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

  // La identidad destino hereda las lapidas: si el cache viaja, la prohibicion
  // de revivir viaja con el.
  for (const conversationId of tombstoned) {
    recordConversationTombstone(targetUserId, conversationId);
  }
}
