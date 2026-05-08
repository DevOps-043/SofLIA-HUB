import type { GChatService } from '../gchat-service.ts';

export function extractEmails(this: GChatService, text: string): string[] {
    if (!text) return [];

    const matches = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
    return Array.from(new Set(matches.map((match) => match.toLowerCase())));
  }
