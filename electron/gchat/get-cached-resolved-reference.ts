import type { GChatService, ChatSpace } from '../gchat-service.ts';

export function getCachedResolvedReference(this: GChatService, reference: string): ChatSpace | null {
    const key = this.normalizeSearchText(reference);
    if (!key) return null;
    return this.resolvedSpaceCache.get(key) || null;
  }
