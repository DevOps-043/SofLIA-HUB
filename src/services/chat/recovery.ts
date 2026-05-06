/**
 * Recuperación de cambios locales que no llegaron a sincronizarse.
 *
 * Si la app se cerró antes de pushear a Supabase, el caché contiene mensajes/
 * conversaciones cuyos IDs no existen en remoto. Este módulo detecta esos
 * casos y los reagrega a la cola pending para que el próximo sync los empuje.
 *
 * Importante: NO usar el conteo de mensajes como heurística (puede causar
 * falsos positivos en escenarios multi-máquina donde otra máquina borró
 * mensajes — eso no significa que tengamos cambios locales pendientes).
 * Solo detectar IDs presentes en caché y ausentes en remoto.
 */

import { loadConversationsFromCache, loadMessagesFromCache } from './cache';
import { dedupeMessages, normalizeConversation } from './normalize';
import {
  getPendingMessageSnapshot,
  queueMessageSnapshot,
  readPendingChatState,
  writePendingChatState,
} from './pending-state';
import type { ChatMessage, PendingChatState } from './types';

/**
 * Re-encola conversaciones que existen en caché pero no en remoto.
 * Devuelve los IDs encolados para que el caller pueda dispararlos al sync.
 */
export function recoverPendingConversationsFromCache(
  userId: string,
  remoteConversationIds: Set<string>,
): string[] {
  const recovered: string[] = [];
  const state = readPendingChatState(userId);
  const next: PendingChatState = {
    conversationUpserts: { ...state.conversationUpserts },
    messageSnapshots: { ...state.messageSnapshots },
    deletedConversationIds: [...state.deletedConversationIds],
  };

  for (const cached of loadConversationsFromCache(userId)) {
    if (cached.user_id !== userId) continue;

    if (
      remoteConversationIds.has(cached.id) ||
      next.deletedConversationIds.includes(cached.id) ||
      next.conversationUpserts[cached.id]
    ) {
      continue;
    }

    const cachedMessages = loadMessagesFromCache(cached.id);
    if (cachedMessages.length === 0) continue;

    next.conversationUpserts[cached.id] = normalizeConversation(cached);
    next.messageSnapshots[cached.id] = dedupeMessages(cachedMessages);
    recovered.push(cached.id);
  }

  if (recovered.length > 0) {
    writePendingChatState(userId, next);
  }

  return recovered;
}

/**
 * Detecta mensajes en caché cuyos IDs no existen en Supabase (= cambios
 * locales sin sincronizar) y los re-encola.
 *
 * Devuelve `true` si se encoló algo. El caller debe entonces disparar el sync.
 */
export function recoverPendingMessagesFromCache(
  userId: string,
  conversationId: string,
  remoteMessages: ChatMessage[],
): boolean {
  const cached = loadMessagesFromCache(conversationId);
  const pending = getPendingMessageSnapshot(userId, conversationId);

  if (cached.length === 0 || pending.length > 0) {
    return false;
  }

  const remoteIds = new Set(remoteMessages.map((m) => m.id));
  const hasLocalOnly = cached.some((m) => !remoteIds.has(m.id));

  if (!hasLocalOnly) {
    return false;
  }

  queueMessageSnapshot(userId, conversationId, cached);
  return true;
}
