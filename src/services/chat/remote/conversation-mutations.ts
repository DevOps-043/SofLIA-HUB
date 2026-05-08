import { supabase } from '../../../lib/supabase';
import { normalizeConversation } from '../normalize';
import type { Conversation } from '../types';

export async function upsertConversationRemote(conversation: Conversation): Promise<Conversation | null> {
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
    return null;
  }

  return normalizeConversation(data);
}
