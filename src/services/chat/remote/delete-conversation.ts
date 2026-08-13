/**
 * Borrado remoto de una conversacion, verificado.
 *
 * Un `DELETE` de PostgREST que no afecta ninguna fila NO devuelve error: si la
 * politica RLS oculta la fila (conversacion de otro usuario, conversacion
 * compartida sin propiedad, sesion Supabase que no corresponde al `user_id`
 * cacheado), la respuesta es exito con cero filas. Tratar eso como borrado
 * limpiaba la cola pendiente y la conversacion reaparecia en la siguiente carga.
 *
 * Por eso se pide `select()` en el propio delete y, cuando no vuelve ninguna
 * fila, se comprueba si la conversacion sigue visible: solo se declara borrada
 * cuando ya no existe.
 */

import { supabase } from '../../../lib/supabase';

export async function deleteConversationRemote(conversationId: string): Promise<boolean> {
  const dependenciesDeleted = await Promise.all([
    deleteRelatedRows('conversation_shares', 'conversation_id', conversationId),
    deleteRelatedRows('workspace_sources', 'conversation_id', conversationId),
  ]);
  if (dependenciesDeleted.some((ok) => !ok)) return false;

  const { error: messageError } = await supabase.from('messages').delete().eq('conversation_id', conversationId);
  if (messageError) {
    console.error('[chat-service] deleteConversationRemote messages FAILED:', messageError.message, '| code:', messageError.code);
    return false;
  }

  const { data, error: conversationError } = await supabase
    .from('conversations')
    .delete()
    .eq('id', conversationId)
    .select('id');

  if (conversationError) {
    console.error('[chat-service] deleteConversationRemote conversation FAILED:', conversationError.message, '| code:', conversationError.code);
    return false;
  }

  if ((data?.length ?? 0) > 0) return true;

  // Cero filas borradas: o ya no existia (borrado idempotente) o la politica la
  // oculto. Solo lo primero es exito.
  return confirmConversationIsGone(conversationId);
}

async function confirmConversationIsGone(conversationId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('conversations')
    .select('id')
    .eq('id', conversationId)
    .maybeSingle();

  if (error) {
    console.error('[chat-service] deleteConversationRemote no pudo verificar el borrado:', error.message, '| code:', error.code);
    return false;
  }
  if (!data) return true;

  console.error(
    `[chat-service] deleteConversationRemote no borro nada para ${conversationId}: la conversacion sigue existiendo (permiso denegado). Se reintentara.`,
  );
  return false;
}

async function deleteRelatedRows(table: string, column: string, conversationId: string): Promise<boolean> {
  const { error } = await supabase.from(table).delete().eq(column, conversationId);
  if (!error) return true;
  if (error.code === '42P01') {
    console.warn(`[chat-service] ${table} table is missing while deleting conversation ${conversationId}; continuing.`);
    return true;
  }
  console.error(`[chat-service] deleteConversationRemote ${table} FAILED:`, error.message, '| code:', error.code);
  return false;
}
