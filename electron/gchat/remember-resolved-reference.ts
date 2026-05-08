import type { GChatService, ChatSpace } from '../gchat-service.ts';

export function rememberResolvedReference(this: GChatService, reference: string, space: ChatSpace): void {
    const normalizedReference = this.normalizeSearchText(reference);
    if (normalizedReference) {
      this.resolvedSpaceCache.set(normalizedReference, space);
    }

    const normalizedDisplayName = this.normalizeSearchText(space.displayName);
    if (normalizedDisplayName) {
      this.resolvedSpaceCache.set(normalizedDisplayName, space);
    }

    const normalizedSpaceName = this.normalizeSearchText(space.name);
    if (normalizedSpaceName) {
      this.resolvedSpaceCache.set(normalizedSpaceName, space);
    }
  }
