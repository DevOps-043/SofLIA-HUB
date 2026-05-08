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

  const { error: conversationError } = await supabase.from('conversations').delete().eq('id', conversationId);
  if (!conversationError) return true;

  console.error('[chat-service] deleteConversationRemote conversation FAILED:', conversationError.message, '| code:', conversationError.code);
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
