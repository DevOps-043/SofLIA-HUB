import { supabase } from '../../../lib/supabase';
import { normalizeConversation } from '../normalize';
import type { Conversation } from '../types';
import { toWriteFailure, type RemoteWriteOutcome } from './error-kind';

export async function upsertConversationRemoteOutcome(
  conversation: Conversation,
): Promise<RemoteWriteOutcome<Conversation>> {
  const { data, error } = await supabase
    .from('conversations')
    .upsert({
      id: conversation.id,
      user_id: conversation.user_id,
      title: conversation.title,
      folder_id: conversation.folder_id || null,
      org_id: conversation.org_id || null,
      is_pinned: conversation.is_pinned || false,
      created_at: conversation.created_at,
      updated_at: conversation.updated_at,
    }, { onConflict: 'id' })
    .select()
    .single();

  if (error) {
    console.error('[chat-service] upsertConversationRemote FAILED:', error.message, '| code:', error.code);
    return toWriteFailure(error);
  }

  return { ok: true, data: normalizeConversation(data) };
}

/** Forma anterior, conservada para los llamadores que solo necesitan el dato. */
export async function upsertConversationRemote(conversation: Conversation): Promise<Conversation | null> {
  const resultado = await upsertConversationRemoteOutcome(conversation);
  return resultado.ok ? resultado.data : null;
}
