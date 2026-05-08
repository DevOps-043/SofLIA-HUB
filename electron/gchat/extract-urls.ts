import type { GChatService } from '../gchat-service.ts';

export function extractUrls(this: GChatService, text: string): string[] {
    if (!text) return [];

    const matches = text.match(/https?:\/\/[^\s<>"'`]+/gi) || [];
    const cleaned = matches
      .map((match) => match.replace(/[)\],.;!?]+$/g, ''))
      .filter(Boolean);

    return Array.from(new Set(cleaned));
  }
