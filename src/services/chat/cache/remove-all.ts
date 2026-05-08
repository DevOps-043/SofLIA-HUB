import { dedupeConversations } from '../normalize';
import { CACHE_KEYS, getMessageCacheKey } from './keys';

export function removeConversationFromAllCaches(conversationId: string): void {
  try {
    localStorage.removeItem(getMessageCacheKey(conversationId));

    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key || !key.startsWith(CACHE_KEYS.CONVERSATIONS_PREFIX)) continue;

      const raw = localStorage.getItem(key);
      if (!raw) continue;

      const filtered = dedupeConversations(JSON.parse(raw)).filter(
        (conversation) => conversation.id !== conversationId,
      );
      localStorage.setItem(key, JSON.stringify(filtered));
    }
  } catch {
    // Errores aqui no deben bloquear la operacion remota.
  }
}
