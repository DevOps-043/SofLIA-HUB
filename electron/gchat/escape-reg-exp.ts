import type { GChatService } from '../gchat-service.ts';

export function escapeRegExp(this: GChatService, value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
