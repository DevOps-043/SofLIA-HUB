import { fetchAccessibleConversations } from './conversation-access';
import { pickConversationByReference } from './conversation-reference';
import { normalizeForMatch } from './text-utils';
import { resolveWhatsAppUser } from './user-resolution';
import type { AppChatConversationSummary } from './types';

export async function listAppChatConversations(
  phoneNumber: string,
  options?: { query?: string; limit?: number },
): Promise<{ success: boolean; conversations?: AppChatConversationSummary[]; error?: string; count?: number }> {
  try {
    const user = await resolveWhatsAppUser(phoneNumber);
    let conversations = await fetchAccessibleConversations(user.userId, user.orgIds);
    const normalizedQuery = normalizeForMatch(options?.query || '');
    if (normalizedQuery) {
      conversations = conversations.filter((conversation) => normalizeForMatch(conversation.title).includes(normalizedQuery));
    }

    const limit = Math.min(Math.max(Number(options?.limit) || 20, 1), 50);
    const trimmed = conversations.slice(0, limit);
    return { success: true, count: trimmed.length, conversations: trimmed };
  } catch (error: any) {
    return { success: false, error: error?.message || 'No pude listar las conversaciones de la app.' };
  }
}

export async function resolveVisibleConversation(phoneNumber: string, conversationRef: string) {
  const user = await resolveWhatsAppUser(phoneNumber);
  const conversations = await fetchAccessibleConversations(user.userId, user.orgIds);
  return { user, conversation: pickConversationByReference(conversations, conversationRef) };
}
