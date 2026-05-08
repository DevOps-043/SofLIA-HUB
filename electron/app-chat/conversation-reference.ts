import { fetchAccessibleConversations } from './conversation-access';
import { normalizeForMatch } from './text-utils';
import { resolveWhatsAppUser } from './user-resolution';
import type { AppChatConversationSummary, ResolvedWhatsAppUser } from './types';

export function pickConversationByReference(
  conversations: AppChatConversationSummary[],
  conversationRef: string,
): AppChatConversationSummary {
  const rawRef = String(conversationRef || '').trim();
  if (!rawRef) {
    throw new Error('Debes indicar el nombre o ID de la conversacion.');
  }

  const exactId = conversations.find((conversation) => conversation.id === rawRef);
  if (exactId) {
    return exactId;
  }

  const normalizedRef = normalizeForMatch(rawRef);
  const scored = conversations
    .map((conversation) => {
      const normalizedTitle = normalizeForMatch(conversation.title);
      let score = 0;
      if (normalizedTitle === normalizedRef) score = 1000;
      else if (normalizedTitle.startsWith(normalizedRef)) score = 800;
      else if (normalizedTitle.includes(normalizedRef)) score = 700;
      else if (normalizedRef.includes(normalizedTitle) && normalizedTitle.length > 0) score = 650;
      else {
        const refTokens = normalizedRef.split(' ').filter(Boolean);
        const titleTokens = normalizedTitle.split(' ').filter(Boolean);
        const overlap = refTokens.filter((token) => titleTokens.includes(token)).length;
        if (overlap > 0) score = overlap * 100;
      }
      return { conversation, score };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) =>
      right.score !== left.score
        ? right.score - left.score
        : new Date(right.conversation.updated_at || right.conversation.created_at).getTime() -
          new Date(left.conversation.updated_at || left.conversation.created_at).getTime(),
    );

  if (scored.length === 0) {
    throw new Error(`No encontre una conversacion que coincida con "${rawRef}".`);
  }
  if (scored.length > 1 && scored[0].score === scored[1].score) {
    const options = scored.slice(0, 5).map((item) => `- ${item.conversation.title} (${item.conversation.id})`).join('\n');
    throw new Error(`La referencia "${rawRef}" es ambigua. Opciones:\n${options}`);
  }
  return scored[0].conversation;
}

export async function resolveConversationForUser(phoneNumber: string, conversationRef: string): Promise<{
  user: ResolvedWhatsAppUser;
  conversation: AppChatConversationSummary;
}> {
  const user = await resolveWhatsAppUser(phoneNumber);
  const conversations = await fetchAccessibleConversations(user.userId, user.orgIds);
  return { user, conversation: pickConversationByReference(conversations, conversationRef) };
}
