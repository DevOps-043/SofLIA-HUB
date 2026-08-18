/**
 * Borrado de una conversacion, logico y verificado.
 *
 * No se borra la fila: se marca `deleted_at`. Un DELETE fisico solo existia en
 * el equipo que lo ejecutaba —los demas seguian listando la conversacion y se
 * la devolvian al primero— y ademas destruia los mensajes. Con la marca, el
 * borrado viaja con el dato y es reversible desde la base.
 *
 * La verificacion sigue siendo necesaria: un `UPDATE` de PostgREST que no
 * afecta ninguna fila NO devuelve error. Si la politica RLS oculta la fila
 * (conversacion de otro usuario, sesion que no corresponde al `user_id`
 * cacheado), la respuesta es exito con cero filas. Tratar eso como borrado
 * limpiaba la cola pendiente y la conversacion reaparecia en la siguiente
 * carga. Por eso se pide `select()` en el propio update y, cuando no vuelve
 * ninguna fila, se comprueba el estado real antes de declararla borrada.
 */

import { supabase } from '../../../lib/supabase';
import { isMissingSoftDeleteColumn, warnMissingSoftDeleteColumn } from './soft-delete';

export async function deleteConversationRemote(conversationId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('conversations')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', conversationId)
    .is('deleted_at', null)
    .select('id');

  if (error) {
    if (isMissingSoftDeleteColumn(error)) {
      warnMissingSoftDeleteColumn('deleteConversationRemote');
      return false;
    }
    console.error('[chat-service] deleteConversationRemote FAILED:', error.message, '| code:', error.code);
    return false;
  }

  if ((data?.length ?? 0) > 0) return true;

  // Cero filas marcadas: o ya estaba borrada (borrado idempotente) o la
  // politica la oculto. Solo lo primero es exito.
  return confirmConversationIsDeleted(conversationId);
}

async function confirmConversationIsDeleted(conversationId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('conversations')
    .select('id, deleted_at')
    .eq('id', conversationId)
    .maybeSingle();

  if (error) {
    if (isMissingSoftDeleteColumn(error)) {
      warnMissingSoftDeleteColumn('deleteConversationRemote');
      return false;
    }
    console.error('[chat-service] deleteConversationRemote no pudo verificar el borrado:', error.message, '| code:', error.code);
    return false;
  }

  // Sin fila: borrada fisicamente antes de este cambio. Con marca: ya estaba
  // borrada, quiza desde otro equipo.
  if (!data) return true;
  if ((data as { deleted_at?: string | null }).deleted_at) return true;

  console.error(
    `[chat-service] deleteConversationRemote no marco nada para ${conversationId}: la conversacion sigue activa (permiso denegado). Se reintentara.`,
  );
  return false;
}
