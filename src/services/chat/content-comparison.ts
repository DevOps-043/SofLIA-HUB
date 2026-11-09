import type { ChatMessage, Conversation } from './types';

/** Comparación conservadora de DTO normalizados que ya pasaron por persistencia JSON. */
export function hasSameChatContent<T extends Conversation | ChatMessage[]>(current: T | undefined, expected: T): boolean {
  return current !== undefined && JSON.stringify(current) === JSON.stringify(expected);
}
