import type { GChatService } from '../gchat-service.ts';

export async function sendMessage(this: GChatService, spaceName: string, text: string, threadName?: string): Promise<{ success: boolean; messageName?: string; error?: string }> {
    const auth = await this.calendarService.getGoogleAuth();
    if (!auth) return { success: false, error: 'Google no conectado' };

    try {
      const { google } = await import('googleapis');
      const chat = google.chat({ version: 'v1', auth });
      const resolved = await this.resolveSpaceReference(chat, spaceName);

      const requestBody: any = { text };
      if (threadName) {
        requestBody.thread = { name: threadName };
      }

      const response = await chat.spaces.messages.create({
        parent: resolved.name,
        requestBody,
      });

      console.log(`[GChatService] Message sent: ${response.data.name}`);
      return { success: true, messageName: response.data.name || undefined };
    } catch (err: any) {
      console.error('[GChatService] SendMessage error:', err.message);
      return { success: false, error: err.message };
    }
  }
