import { getLiaClient } from './clients';
import { resolveConversationForUser } from './conversation-reference';
import { truncateSnippet } from './text-utils';
import type { AppChatContextMessage, AppChatConversationSummary } from './types';

export async function getAppChatConversationContext(
  phoneNumber: string,
  conversationRef: string,
  limit: number = 12,
): Promise<{
  success: boolean;
  conversation?: AppChatConversationSummary;
  messages?: AppChatContextMessage[];
  count?: number;
  error?: string;
}> {
  const lia = getLiaClient();
  if (!lia) return { success: false, error: 'Lia no esta configurado en este dispositivo.' };

  try {
    const { conversation } = await resolveConversationForUser(phoneNumber, conversationRef);
    const safeLimit = Math.min(Math.max(Number(limit) || 12, 1), 50);
    const { data, error } = await lia
      .from('messages')
      .select('id, role, content, metadata, created_at')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: false })
      .limit(safeLimit);
    if (error) throw new Error(error.message);

    const messages = [...(data || [])].reverse().map((message: any) => ({
      id: message.id,
      role: message.role === 'user' ? 'user' : 'model',
      text: truncateSnippet(message.content, 1200),
      created_at: message.created_at,
      sources_count: Array.isArray(message.metadata?.sources) ? message.metadata.sources.length : 0,
      images_count: Array.isArray(message.metadata?.images) ? message.metadata.images.length : 0,
      feedback: message.metadata?.feedback === 'like' || message.metadata?.feedback === 'dislike'
        ? message.metadata.feedback
        : undefined,
    })) satisfies AppChatContextMessage[];

    return { success: true, conversation, messages, count: messages.length };
  } catch (error: any) {
    return { success: false, error: error?.message || 'No pude leer el contexto de esa conversacion.' };
  }
}
