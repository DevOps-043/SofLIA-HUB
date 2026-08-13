import { supabase } from '../../../lib/supabase';
import { dedupeMessages } from '../normalize';
import type { ChatMessage } from '../types';
import { toWriteFailure, type RemoteWriteOutcome } from './error-kind';

export async function syncMessagesRemoteOutcome(
  conversationId: string,
  userId: string,
  messages: ChatMessage[],
): Promise<RemoteWriteOutcome<null>> {
  const validMessages = dedupeMessages(messages);
  if (validMessages.length === 0) return { ok: true, data: null };

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
  if (!error) return { ok: true, data: null };

  console.error('[chat-service] syncMessagesRemote upsert FAILED:', error.message, '| code:', error.code);
  return toWriteFailure(error);
}

/** Forma anterior, conservada para los llamadores que solo necesitan el exito. */
export async function syncMessagesRemote(
  conversationId: string,
  userId: string,
  messages: ChatMessage[],
): Promise<boolean> {
  return (await syncMessagesRemoteOutcome(conversationId, userId, messages)).ok;
}
