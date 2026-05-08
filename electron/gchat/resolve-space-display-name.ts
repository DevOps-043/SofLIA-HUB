import type { GChatService } from '../gchat-service.ts';

export function resolveSpaceDisplayName(this: GChatService, space: any): string {
    if (typeof space?.displayName === 'string' && space.displayName.trim()) {
      return space.displayName.trim();
    }

    if (space?.spaceType === 'DIRECT_MESSAGE') {
      return `Chat directo (${space?.name || 'sin identificar'})`;
    }

    if (typeof space?.name === 'string' && space.name.trim()) {
      return space.name.trim();
    }

    return 'Espacio sin nombre';
  }
