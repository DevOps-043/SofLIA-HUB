import type { GChatService, ChatSpace } from '../gchat-service.ts';

export function isHumanDirectMessageSpace(this: GChatService, space: ChatSpace): boolean {
    return this.isDirectMessageSpace(space)
      && !space.singleUserBotDm
      && (space.joinedDirectHumanUserCount === undefined || space.joinedDirectHumanUserCount >= 2);
  }
