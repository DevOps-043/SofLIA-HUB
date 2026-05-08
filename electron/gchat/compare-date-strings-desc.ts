import type { GChatService } from '../gchat-service.ts';

export function compareDateStringsDesc(this: GChatService, left?: string, right?: string): number {
    const leftTime = left ? Date.parse(left) : Number.NaN;
    const rightTime = right ? Date.parse(right) : Number.NaN;
    const leftValid = Number.isFinite(leftTime);
    const rightValid = Number.isFinite(rightTime);

    if (leftValid && rightValid) {
      return rightTime - leftTime;
    }
    if (leftValid) return -1;
    if (rightValid) return 1;
    return 0;
  }
