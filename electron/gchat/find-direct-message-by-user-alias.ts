import type { GChatService, ChatSpace } from '../gchat-service.ts';

export async function findDirectMessageByUserAlias(this: GChatService, chat: any, normalizedAlias: string): Promise<ChatSpace | null> {
    try {
      const response = await chat.spaces.findDirectMessage({ name: normalizedAlias });
      if (!response?.data?.name) {
        return null;
      }
      return this.mapSpace(response.data);
    } catch {
      return null;
    }
  }
