import type { ChatMessage } from '../types';

export function generateTitle(messages: ChatMessage[]): string {
  const firstUserMessage = messages.find((message) => message.role === 'user');
  if (!firstUserMessage) return 'Nueva conversacion';

  const text = firstUserMessage.text.trim();
  return text.length > 40 ? `${text.slice(0, 40)}...` : text;
}
