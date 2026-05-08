import type { GChatService, ChatSpace, ChatMessage } from '../gchat-service.ts';

export async function getMessages(this: GChatService, spaceName: string, maxResults?: number): Promise<{ success: boolean; messages?: ChatMessage[]; resolvedSpace?: ChatSpace; urls?: string[]; error?: string }> {
    const auth = await this.calendarService.getGoogleAuth();
    if (!auth) return { success: false, error: 'Google no conectado' };

    try {
      const { google } = await import('googleapis');
      const chat = google.chat({ version: 'v1', auth });
      const resolved = await this.resolveSpaceReference(chat, spaceName);
      const rawMessages = await this.listRecentRawMessages(chat, resolved.name, maxResults || 25);

      const messages: ChatMessage[] = rawMessages
        .map((m: any) => {
          const text = this.extractMessageText(m);
          return {
            name: m.name || '',
            sender: {
              name: m.sender?.name || '',
              displayName: this.resolveSenderDisplayName(m.sender),
              email: m.sender?.email || undefined,
            },
            createTime: m.createTime || '',
            text,
            threadName: m.thread?.name || undefined,
            urls: this.extractUrls(text),
          };
        })
        .sort((left, right) => this.compareDateStringsDesc(left.createTime, right.createTime));

      const urls = Array.from(new Set(messages.flatMap((message) => message.urls || [])));

      return {
        success: true,
        resolvedSpace: resolved.space,
        messages,
        urls,
      };
    } catch (err: any) {
      console.error('[GChatService] GetMessages error:', err.message);
      return { success: false, error: err.message };
    }
  }
