import type { GChatService } from '../gchat-service.ts';

export function extractSpaceNameFromUrl(this: GChatService, reference: string): string | null {
    try {
      const parsed = new URL(reference);
      const directPathMatch = parsed.pathname.match(/\/(?:dm|room|space)\/([^/?#]+)/i);
      if (directPathMatch?.[1]) {
        return `spaces/${directPathMatch[1]}`;
      }

      const hash = parsed.hash || '';
      const hashMatch = hash.match(/\/(?:dm|room|space)\/([^/?#]+)/i);
      if (hashMatch?.[1]) {
        return `spaces/${hashMatch[1]}`;
      }
    } catch {
      return null;
    }

    return null;
  }
