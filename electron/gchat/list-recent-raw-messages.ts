import type { GChatService } from '../gchat-service.ts';

export async function listRecentRawMessages(this: GChatService, chat: any, spaceName: string, limit: number, maxPages: number = 100): Promise<any[]> {
    const safeLimit = Math.max(1, Math.min(limit || 25, 1000));
    const tail: any[] = [];
    let pageToken: string | undefined;
    let pageCount = 0;

    do {
      const response = await chat.spaces.messages.list({
        parent: spaceName,
        pageSize: 1000,
        ...(pageToken ? { pageToken } : {}),
      });

      const messages = Array.isArray(response?.data?.messages) ? response.data.messages : [];
      for (const message of messages) {
        tail.push(message);
        if (tail.length > safeLimit) {
          tail.shift();
        }
      }

      pageToken = response?.data?.nextPageToken || undefined;
      pageCount += 1;
    } while (pageToken && pageCount < maxPages);

    return tail.sort((left, right) => this.compareDateStringsDesc(left?.createTime, right?.createTime));
  }
