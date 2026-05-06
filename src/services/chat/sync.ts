/**
 * Sincronización del estado pendiente con Supabase.
 *
 * Procesa la cola en orden: borrados → upserts de conversaciones → snapshots
 * de mensajes. Cada operación exitosa limpia su entrada pendiente; fallos
 * dejan la entrada para el siguiente intento (resiliencia ante red intermitente).
 */

import { isSupabaseConfigured } from '../../lib/supabase';
import { saveConversationToCache, saveMessagesToCache } from './cache';
import {
  clearPendingConversationDelete,
  clearPendingConversationUpsert,
  clearPendingMessageSnapshot,
  getPendingConversationUpserts,
  readPendingChatState,
} from './pending-state';
import { deleteConversationRemote, syncMessagesRemote, upsertConversationRemote } from './remote';

export async function syncPendingChatState(
  userId: string,
  conversationIds?: string[],
): Promise<void> {
  if (!userId || !isSupabaseConfigured()) {
    return;
  }

  const targetIds = new Set(conversationIds || []);
  const isTargetedSync = targetIds.size > 0;

  // 1. Procesar borrados primero (evita reescribir lo que se acaba de borrar).
  const deletedIds = readPendingChatState(userId).deletedConversationIds;
  for (const conversationId of deletedIds) {
    if (isTargetedSync && !targetIds.has(conversationId)) continue;

    const deleted = await deleteConversationRemote(conversationId);
    if (deleted) {
      clearPendingConversationDelete(userId, conversationId);
    }
  }

  // 2. Upsert de conversaciones nuevas o modificadas.
  for (const pending of getPendingConversationUpserts(userId)) {
    if (isTargetedSync && !targetIds.has(pending.id)) continue;

    const synced = await upsertConversationRemote(pending);
    if (!synced) continue;

    saveConversationToCache(userId, {
      ...synced,
      is_shared: pending.is_shared,
      share_permission: pending.share_permission,
      can_edit: pending.can_edit,
      can_share: pending.can_share,
      shared_by_user_id: pending.shared_by_user_id,
      share_token: pending.share_token,
      shared_at: pending.shared_at,
    });
    clearPendingConversationUpsert(userId, pending.id);
  }

  // 3. Snapshots de mensajes (después de las conversaciones para evitar FK violations).
  const stateAfterConversationSync = readPendingChatState(userId);
  for (const [conversationId, snapshot] of Object.entries(stateAfterConversationSync.messageSnapshots)) {
    if (isTargetedSync && !targetIds.has(conversationId)) continue;

    const synced = await syncMessagesRemote(conversationId, userId, snapshot);
    if (synced) {
      clearPendingMessageSnapshot(userId, conversationId);
      saveMessagesToCache(conversationId, snapshot);
    }
  }
}
