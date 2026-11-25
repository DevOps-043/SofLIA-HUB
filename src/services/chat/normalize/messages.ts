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
  const edit = raw.revision;
  const revision = raw.role === 'user' && edit && Number.isSafeInteger(edit.editedAt) && edit.editedAt > 0
    && Array.isArray(edit.supersedes) ? {
      editedAt: edit.editedAt,
      supersedes: [...new Set(edit.supersedes.flatMap(id => typeof id === 'string' ? [id.trim()] : []))]
        .filter(id => id && id !== raw.id!.trim()),
    } : undefined;

  return {
    id: raw.id!.trim(),
    role: raw.role === 'user' ? 'user' : 'model',
    text: typeof raw.text === 'string' ? raw.text : '',
    timestamp: typeof raw.timestamp === 'number' ? raw.timestamp : Date.now(),
    sources: sources && sources.length > 0 ? sources : undefined,
    images: images && images.length > 0 ? images : undefined,
    feedback: raw.feedback === 'like' || raw.feedback === 'dislike' ? raw.feedback : undefined,
    backgroundJobId: typeof raw.backgroundJobId === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(raw.backgroundJobId) ? raw.backgroundJobId : undefined,
    revision,
  };
}

export function dedupeMessages(messages: ChatMessage[]): ChatMessage[] {
  const byId = new Map<string, ChatMessage>();
  const originalOrder = new Map<string, number>();

  let idx = 0;
  for (const rawMessage of messages) {
    if (rawMessage?.id && !originalOrder.has(rawMessage.id.trim())) {
      originalOrder.set(rawMessage.id.trim(), idx++);
    }

    const message = normalizeMessage(rawMessage);
    if (!message) continue;

    const existing = byId.get(message.id);
    if (!existing) {
      byId.set(message.id, message);
      continue;
    }
    const editedAt = (message.revision?.editedAt ?? 0) - (existing.revision?.editedAt ?? 0);
    const preferred = editedAt > 0 || (editedAt === 0 && getMessageScore(message) >= getMessageScore(existing)) ? message : existing;
    if (message.text === existing.text && !preferred.backgroundJobId) preferred.backgroundJobId = existing.backgroundJobId ?? message.backgroundJobId;
    if (preferred.revision && message.revision && existing.revision) {
      preferred.revision = { ...preferred.revision, supersedes: [...new Set([...existing.revision.supersedes, ...message.revision.supersedes])] };
    }
    byId.set(message.id, preferred);
  }

  const superseded = new Set(Array.from(byId.values()).flatMap(message => message.revision?.supersedes ?? []));
  return Array.from(byId.values()).filter(message => !superseded.has(message.id)).sort((a, b) => {
    if (a.timestamp !== b.timestamp) {
      return a.timestamp - b.timestamp;
    }
    if (a.role !== b.role) {
      return a.role === 'user' ? -1 : 1;
    }
    return (originalOrder.get(a.id) ?? 0) - (originalOrder.get(b.id) ?? 0);
  });
}

function getMessageScore(message: ChatMessage): number {
  return `${message.text || ''}|${message.images?.length || 0}|${message.sources?.length || 0}`.length;
}
