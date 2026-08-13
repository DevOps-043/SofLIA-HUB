/**
 * Sincronización del estado pendiente con Supabase.
 *
 * Procesa la cola en orden: borrados → upserts de conversaciones → snapshots
 * de mensajes. Cada operación exitosa limpia su entrada pendiente; un fallo
 * TRANSITORIO deja la entrada para el siguiente intento (resiliencia ante red
 * intermitente).
 *
 * Un fallo PERMANENTE no se reintenta. Sin esa distinción, una fila que la base
 * de datos nunca va a aceptar se queda en la cola para siempre: cada guardado la
 * reenvía, la cola no drena nunca y el registro de Supabase se llena de
 * rechazos. Pasó de verdad, con miles de `42501` por hora sobre `conversations`
 * y `messages` — una conversación creada bajo otra identidad, reclamada por la
 * activa, que RLS rechazaba correctamente en cada intento.
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
import { deleteConversationRemote } from './remote';
import { upsertConversationRemoteOutcome } from './remote/conversation-mutations';
import { syncMessagesRemoteOutcome } from './remote/message-sync';

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

    // Una conversacion de otra identidad no es nuestra para escribirla. Puede
    // ser compartida por otro usuario, o una copia local reetiquetada por la
    // migracion de identidad mientras la fila remota conserva su dueño. En
    // ambos casos RLS la rechaza siempre: se saca de la cola en vez de
    // reintentarla en cada guardado.
    if (pending.user_id && pending.user_id !== userId) {
      console.warn(
        `[chat-service] La conversacion ${pending.id} pertenece a otra identidad (${pending.user_id}); ` +
        'no se sincroniza y se retira de la cola.',
      );
      clearPendingConversationUpsert(userId, pending.id);
      continue;
    }

    const resultado = await upsertConversationRemoteOutcome(pending);
    if (!resultado.ok) {
      if (resultado.permanente) {
        console.warn(
          `[chat-service] La conversacion ${pending.id} no se puede guardar en Supabase y no se reintentara: ` +
          `${resultado.message}. Sigue disponible en este equipo.`,
        );
        clearPendingConversationUpsert(userId, pending.id);
      }
      continue;
    }
    const synced = resultado.data;

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

    const resultado = await syncMessagesRemoteOutcome(conversationId, userId, snapshot);
    if (resultado.ok) {
      clearPendingMessageSnapshot(userId, conversationId);
      saveMessagesToCache(conversationId, snapshot);
      continue;
    }

    if (resultado.permanente) {
      // Tipicamente arrastran el rechazo de su conversacion: si esa fila
      // pertenece a otra identidad, sus mensajes tampoco se van a admitir.
      console.warn(
        `[chat-service] Los mensajes de ${conversationId} no se pueden guardar en Supabase y no se reintentaran: ` +
        `${resultado.message}. Siguen disponibles en este equipo.`,
      );
      clearPendingMessageSnapshot(userId, conversationId);
      saveMessagesToCache(conversationId, snapshot);
    }
  }
}
