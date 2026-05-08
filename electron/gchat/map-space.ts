import type { GChatService, ChatSpace } from '../gchat-service.ts';

export function mapSpace(this: GChatService, space: any): ChatSpace {
    return {
      name: space?.name || '',
      displayName: this.resolveSpaceDisplayName(space),
      type: space?.spaceType || space?.type || '',
      spaceType: space?.spaceType || undefined,
      spaceThreadingState: space?.spaceThreadingState || undefined,
      spaceUri: space?.spaceUri || undefined,
      lastActiveTime: space?.lastActiveTime || undefined,
      singleUserBotDm: Boolean(space?.singleUserBotDm),
      joinedDirectHumanUserCount: Number.isFinite(space?.membershipCount?.joinedDirectHumanUserCount)
        ? Number(space.membershipCount.joinedDirectHumanUserCount)
        : undefined,
    };
  }
