/**
 * Ids de conversaciones que el usuario ya borro, en cualquiera de sus equipos.
 *
 * Es la mitad que faltaba del borrado: marcar `deleted_at` oculta la fila en
 * los listados, pero un equipo que no ejecuto el borrado conserva la
 * conversacion en su cache y en su cola pendiente, y volveria a subirla. Con
 * esta consulta cada equipo aprende los borrados ajenos y los convierte en
 * lapidas locales.
 */

import { supabase } from '../../../lib/supabase';
import { MAX_CONVERSATIONS } from '../types';
import { isMissingSoftDeleteColumn, warnMissingSoftDeleteColumn } from './soft-delete';

export async function fetchDeletedConversationIds(userId: string): Promise<string[]> {
  if (!userId) return [];

  const { data, error } = await supabase
    .from('conversations')
    .select('id')
    .eq('user_id', userId)
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false })
    .limit(MAX_CONVERSATIONS);

  if (error) {
    if (isMissingSoftDeleteColumn(error)) {
      warnMissingSoftDeleteColumn('fetchDeletedConversationIds');
    } else {
      console.error('[chat-service] fetchDeletedConversationIds FAILED:', error.message, '| code:', error.code);
    }
    return [];
  }

  return (data || [])
    .map((row: { id?: string }) => row?.id)
    .filter((id: string | undefined): id is string => Boolean(id));
}
