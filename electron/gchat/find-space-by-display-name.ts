import type { GChatService, ChatSpace } from '../gchat-service.ts';

export function findSpaceByDisplayName(this: GChatService, spaces: ChatSpace[], hint: string): ChatSpace | null {
    const normalizedHint = this.normalizeSearchText(hint);
    if (!normalizedHint) return null;

    const exact = spaces.find((space) => this.normalizeSearchText(space.displayName) === normalizedHint);
    if (exact) return exact;

    const partial = spaces.find((space) => this.normalizeSearchText(space.displayName).includes(normalizedHint));
    return partial || null;
  }
