import type { ChatMessage, Conversation } from '../../services/chat-service';

export function hasActivePlaceholder(messages: ChatMessage[]): boolean {
  return messages.some((message) => isActivePlaceholder(message));
}

function isActivePlaceholder(message: ChatMessage): boolean {
  if (message.role !== 'model') return false;
  const text = message.text?.trim() || '';
  const hasImages = Boolean(message.images && message.images.length > 0);
  return !hasImages && (!text || text === '...');
}

/**
 * Devuelve los mensajes sin placeholders "..." de un turno en curso. Se usa al
 * cachear y al cargar una conversación para que un turno interrumpido nunca
 * deje un "..." pegado que bloquee el input de forma permanente.
 */
export function withoutActivePlaceholders(messages: ChatMessage[]): ChatMessage[] {
  return messages.filter((message) => !isActivePlaceholder(message));
}

export function areConversationListsEqual(left: Conversation[], right: Conversation[]): boolean {
  if (left.length !== right.length) return false;

  return left.every((conversation, index) => {
    const other = right[index];
    return (
      conversation.id === other?.id &&
      conversation.title === other?.title &&
      conversation.folder_id === other?.folder_id &&
      conversation.updated_at === other?.updated_at &&
      conversation.is_shared === other?.is_shared &&
      conversation.share_permission === other?.share_permission &&
      conversation.can_edit === other?.can_edit &&
      conversation.can_share === other?.can_share
    );
  });
}

export function areMessageListsEqual(left: ChatMessage[], right: ChatMessage[]): boolean {
  if (left.length !== right.length) return false;

  return left.every((message, index) => {
    const other = right[index];
    return (
      message.id === other?.id &&
      message.role === other?.role &&
      message.text === other?.text &&
      message.timestamp === other?.timestamp &&
      JSON.stringify(message.sources || []) === JSON.stringify(other?.sources || []) &&
      JSON.stringify(message.images || []) === JSON.stringify(other?.images || []) &&
      message.feedback === other?.feedback
    );
  });
}
