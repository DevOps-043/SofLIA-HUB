import type { GChatService } from '../gchat-service.ts';

export function normalizeUserAlias(this: GChatService, reference: string): string | null {
    const value = String(reference || '').trim();
    if (!value) return null;

    if (value.startsWith('users/')) {
      return value;
    }

    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(value)) {
      return `users/${value.toLowerCase()}`;
    }

    return null;
  }
