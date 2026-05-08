import {
  ACTIVE_MODEL_PLACEHOLDER,
  type ChatMessage,
} from '../types';

export function isPersistableMessage(raw: Partial<ChatMessage> & { id?: string | null }): boolean {
  const id = raw.id?.trim();
  if (!id) return false;

  const text = typeof raw.text === 'string' ? raw.text : '';
  const images = Array.isArray(raw.images) ? raw.images.filter(Boolean) : [];
  const isPlaceholderModelMessage =
    raw.role === 'model' &&
    text.trim() === ACTIVE_MODEL_PLACEHOLDER &&
    images.length === 0;

  return !isPlaceholderModelMessage && Boolean(text.trim() || images.length > 0);
}

export function normalizeMessage(
  raw: Partial<ChatMessage> & { id?: string | null },
): ChatMessage | null {
  if (!isPersistableMessage(raw)) return null;

  const images = Array.isArray(raw.images) ? raw.images.filter(Boolean) : undefined;
  const sources = Array.isArray(raw.sources) ? raw.sources.filter((source) => source?.uri) : undefined;

  return {
    id: raw.id!.trim(),
    role: raw.role === 'user' ? 'user' : 'model',
    text: typeof raw.text === 'string' ? raw.text : '',
    timestamp: typeof raw.timestamp === 'number' ? raw.timestamp : Date.now(),
    sources: sources && sources.length > 0 ? sources : undefined,
    images: images && images.length > 0 ? images : undefined,
    feedback: raw.feedback === 'like' || raw.feedback === 'dislike' ? raw.feedback : undefined,
  };
}

export function dedupeMessages(messages: ChatMessage[]): ChatMessage[] {
  const byId = new Map<string, ChatMessage>();

  for (const rawMessage of messages) {
    const message = normalizeMessage(rawMessage);
    if (!message) continue;

    const existing = byId.get(message.id);
    if (!existing) {
      byId.set(message.id, message);
      continue;
    }
    byId.set(message.id, getMessageScore(message) >= getMessageScore(existing) ? message : existing);
  }

  return Array.from(byId.values()).sort((a, b) => a.timestamp - b.timestamp);
}

function getMessageScore(message: ChatMessage): number {
  return `${message.text || ''}|${message.images?.length || 0}|${message.sources?.length || 0}`.length;
}
