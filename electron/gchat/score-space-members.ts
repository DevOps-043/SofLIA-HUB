import type { GChatService, ChatSpace } from '../gchat-service.ts';

export async function scoreSpaceMembers(this: GChatService, chat: any, space: ChatSpace, normalizedHint: string): Promise<number> {
    try {
      const response = await chat.spaces.members.list({
        parent: space.name,
        pageSize: 20,
      });

      const memberships = Array.isArray(response?.data?.memberships) ? response.data.memberships : [];
      let score = 0;

      for (const membership of memberships) {
        const displayName = this.normalizeSearchText(membership?.member?.displayName || '');
        const email = this.normalizeSearchText(membership?.member?.email || '');
        const name = this.normalizeSearchText(membership?.member?.name || '');

        if (displayName.includes(normalizedHint) || email.includes(normalizedHint) || name.includes(normalizedHint)) {
          score += 8;
        }
      }

      return score;
    } catch {
      return 0;
    }
  }
