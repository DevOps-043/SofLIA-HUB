import type { GChatService, ChatSpace } from '../gchat-service.ts';

export function sortSpaces(this: GChatService, spaces: ChatSpace[]): ChatSpace[] {
    return [...spaces].sort((left, right) => {
      const byActivity = this.compareDateStringsDesc(left.lastActiveTime, right.lastActiveTime);
      if (byActivity !== 0) return byActivity;
      return 0;
    });
  }
