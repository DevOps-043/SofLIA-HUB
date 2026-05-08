import { supabase } from '../../../lib/supabase';
import { dedupeMessages } from '../normalize';
import type { ChatMessage } from '../types';

export async function syncMessagesRemote(
  conversationId: string,
  userId: string,
  messages: ChatMessage[],
): Promise<boolean> {
  const validMessages = dedupeMessages(messages);
  if (validMessages.length === 0) return true;

  const rows = validMessages.map((message) => ({
    id: message.id,
    conversation_id: conversationId,
    user_id: userId,
    role: message.role,
    content: message.text,
    created_at: new Date(message.timestamp).toISOString(),
    metadata: {
      sources: message.sources || null,
      images: message.images || null,
      feedback: message.feedback || null,
    },
  }));

  const { error } = await supabase.from('messages').upsert(rows, { onConflict: 'id' });
  if (!error) return true;

  console.error('[chat-service] syncMessagesRemote upsert FAILED:', error.message, '| code:', error.code);
  return false;
}
