import { hasSameChatContent } from '../content-comparison';
import type { ChatMessage, Conversation } from '../types';

/** Revisión efímera de publicación local; no concede autorización remota. */
export function captureCacheReview<T extends Conversation | ChatMessage[]>(key: string, expected: T, readCurrent: () => T | undefined): () => boolean {
  try {
    const before = localStorage.getItem(key);
    const eligible = before === null || (Array.isArray(JSON.parse(before)) && hasSameChatContent(readCurrent(), expected));
    return () => {
      try { return eligible && localStorage.getItem(key) === before; }
      catch { return false; }
    };
  } catch { return () => false; }
}
