import type { GChatService, ChatSpace } from '../gchat-service.ts';

export async function listSpacesInternal(this: GChatService, chat: any): Promise<ChatSpace[]> {
    const response = await chat.spaces.list({ pageSize: 100 });
    const spaces: ChatSpace[] = (response.data.spaces || []).map((space: any) => this.mapSpace(space));
    return this.sortSpaces(spaces);
  }
