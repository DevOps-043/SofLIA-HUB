import type { GChatService, ChatSpace } from '../gchat-service.ts';

export async function detectSelfUserIdentifiers(this: GChatService, chat: any, spaces: ChatSpace[]): Promise<Set<string>> {
    if (this.selfUserDetectionDone) {
      return this.selfUserIdentifiers;
    }

    const senderPresence = new Map<string, number>();
    const candidateSpaces = spaces.filter((space) => this.isHumanDirectMessageSpace(space)).slice(0, 8);

    for (const space of candidateSpaces) {
      try {
        const recentMessages = await this.listRecentRawMessages(chat, space.name, 40, 4);
        const seenInSpace = new Set<string>();

        for (const message of recentMessages) {
          const senderId = this.normalizeSearchText(message?.sender?.name || '');
          if (senderId) {
            seenInSpace.add(senderId);
          }
        }

        for (const senderId of seenInSpace) {
          senderPresence.set(senderId, (senderPresence.get(senderId) || 0) + 1);
        }
      } catch {
        // Ignore spaces that can't be sampled.
      }
    }

    const ranked = [...senderPresence.entries()].sort((left, right) => right[1] - left[1]);
    if (ranked.length > 0) {
      const highestCount = ranked[0][1];
      for (const [senderId, count] of ranked) {
        if (count >= 2 && count >= highestCount - 1) {
          this.selfUserIdentifiers.add(senderId);
        }
      }
    }

    this.selfUserDetectionDone = true;
    return this.selfUserIdentifiers;
  }
