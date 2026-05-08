import type { ChatMessage } from '../../services/chat-service';

export const PLACEHOLDER_TEXT = '...';

export function shouldShowLoadingUi(isLoading: boolean, messages: ChatMessage[]): boolean {
  const lastMessage = messages[messages.length - 1];
  return isLoading || Boolean(
    lastMessage &&
    lastMessage.role === 'model' &&
    (!lastMessage.text || lastMessage.text.trim() === PLACEHOLDER_TEXT) &&
    !(lastMessage.images && lastMessage.images.length > 0)
  );
}

export function dedupeMessageList(items: ChatMessage[]) {
  const seen = new Set<string>();
  return items.filter((message) => {
    if (!message?.id || seen.has(message.id)) return false;
    seen.add(message.id);
    return true;
  });
}

export function createUserMessage(text: string, images: string[]): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role: 'user',
    text,
    timestamp: Date.now(),
    images: images.length > 0 ? [...images] : undefined,
  };
}

export function createAiPlaceholder(id: string): ChatMessage {
  return {
    id,
    role: 'model',
    text: PLACEHOLDER_TEXT,
    timestamp: Date.now(),
  };
}
