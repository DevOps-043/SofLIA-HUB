import { randomUUID } from 'node:crypto';
import { getLiaClient } from './clients';
import { resolveConversationForUser } from './conversation-reference';
import type { AppChatConversationSummary } from './types';

export async function appendNoteToAppConversation(
  phoneNumber: string,
  conversationRef: string,
  content: string,
): Promise<{ success: boolean; error?: string; conversation?: AppChatConversationSummary; messageId?: string }> {
  const lia = getLiaClient();
  if (!lia) return { success: false, error: 'Lia no esta configurado en este dispositivo.' };

  const trimmedContent = String(content || '').trim();
  if (!trimmedContent) {
    return { success: false, error: 'Debes indicar el contenido que quieres agregar.' };
  }

  try {
    const { user, conversation } = await resolveConversationForUser(phoneNumber, conversationRef);
    if (conversation.permission === 'view') {
      return { success: false, error: `La conversacion "${conversation.title}" esta compartida en solo lectura.` };
    }

    const messageId = randomUUID();
    const createdAt = new Date().toISOString();
    const { error: insertError } = await lia.from('messages').insert({
      id: messageId,
      conversation_id: conversation.id,
      user_id: user.userId,
      role: 'user',
      content: trimmedContent,
      metadata: {
        source: 'whatsapp_app_chat',
        appended_via: 'whatsapp',
        sender_phone: phoneNumber,
        sender_user_id: user.userId,
        sender_email: user.email,
        sender_name: user.fullName,
      },
      created_at: createdAt,
    });
    if (insertError) throw new Error(insertError.message);

    const { error: updateError } = await lia.from('conversations').update({ updated_at: createdAt }).eq('id', conversation.id);
    if (updateError) throw new Error(updateError.message);
    return { success: true, conversation: { ...conversation, updated_at: createdAt }, messageId };
  } catch (error: any) {
    return { success: false, error: error?.message || 'No pude agregar la nota a la conversacion.' };
  }
}
