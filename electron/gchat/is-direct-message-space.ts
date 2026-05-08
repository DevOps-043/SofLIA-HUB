import type { GChatService, ChatSpace } from '../gchat-service.ts';

export function isDirectMessageSpace(this: GChatService, space: ChatSpace): boolean {
    return (space.spaceType || '').toUpperCase() === 'DIRECT_MESSAGE' || String(space.type).toUpperCase() === 'DM';
  }
