/**
 * Aprende en este equipo los borrados hechos en otro.
 *
 * Ocultar la fila marcada no basta: el equipo que no ejecuto el borrado sigue
 * teniendo la conversacion en su cache y, si tiene mensajes locales, la
 * recuperacion la vuelve a encolar y a subir. Traducir cada `deleted_at`
 * remoto a una lapida local reusa las protecciones que ya existen —listados,
 * recuperacion de cache, guardado de mensajes y migracion de identidad— en vez
 * de duplicar la regla en cada una.
 */

import { removeConversationFromAllCaches } from '../cache';
import { purgeConversationFromAllPendingStates, queueConversationDelete } from '../pending-state';
import { fetchDeletedConversationIds } from '../remote/deleted-conversations';
import { syncPendingChatState } from '../sync';
import { getConversationTombstones, recordConversationTombstoneForAllIdentities } from '../tombstones';
import type { Conversation } from '../types';

/** Devuelve los ids que este equipo no sabia que estaban borrados. */
export async function reconcileRemoteConversationDeletions(userId: string): Promise<string[]> {
  if (!userId) return [];

  // La reconciliacion es oportunista: sin red, el listado sigue funcionando.
  const remoteDeletedIds = await fetchDeletedConversationIds(userId).catch((err): string[] => {
    console.error('[chat-service] reconcileRemoteConversationDeletions exception:', err);
    return [];
  });
  if (remoteDeletedIds.length === 0) return [];

  const conocidos = getConversationTombstones(userId);
  const nuevos = remoteDeletedIds.filter((id) => !conocidos.has(id));

  for (const conversationId of nuevos) {
    recordConversationTombstoneForAllIdentities(userId, conversationId);
    removeConversationFromAllCaches(conversationId);
    purgeConversationFromAllPendingStates(conversationId);
  }

  return nuevos;
}

/**
 * El sentido contrario: un chat que este equipo ya borro pero que en Supabase
 * sigue activo. Pasa con todo lo borrado antes de que el borrado fuera logico
 * —el DELETE fisico podia quedar en cero filas sin avisar— y con cualquier
 * borrado cuya sincronizacion se perdio. Sin esto, el otro equipo lo seguiria
 * mostrando para siempre y solo se arreglaria borrandolo a mano otra vez.
 *
 * Solo se marca lo propio: una conversacion compartida por otra persona se
 * oculta en este equipo, pero no se borra en el suyo.
 */
export async function pushLocalTombstonesToRemote(
  userId: string,
  remoteConversations: Conversation[],
): Promise<string[]> {
  if (!userId || remoteConversations.length === 0) return [];

  const lapidas = getConversationTombstones(userId);
  if (lapidas.size === 0) return [];

  const porBorrar = remoteConversations
    .filter((conversation) => lapidas.has(conversation.id) && conversation.user_id === userId)
    .map((conversation) => conversation.id);
  if (porBorrar.length === 0) return [];

  for (const conversationId of porBorrar) queueConversationDelete(userId, conversationId);
  try {
    await syncPendingChatState(userId, porBorrar);
  } catch (err) {
    console.error('[chat-service] pushLocalTombstonesToRemote sync exception:', err);
  }

  return porBorrar;
}
