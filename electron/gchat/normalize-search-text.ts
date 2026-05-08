import type { GChatService } from '../gchat-service.ts';

export function normalizeSearchText(this: GChatService, value: string): string {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }
