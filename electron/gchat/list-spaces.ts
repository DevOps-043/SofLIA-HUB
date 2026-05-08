import type { GChatService, ChatSpace } from '../gchat-service.ts';

export async function listSpaces(this: GChatService): Promise<{ success: boolean; spaces?: ChatSpace[]; error?: string }> {
    const auth = await this.calendarService.getGoogleAuth();
    if (!auth) return { success: false, error: 'Google no conectado' };

    try {
      const { google } = await import('googleapis');
      const chat = google.chat({ version: 'v1', auth });

      const spaces = await this.listSpacesInternal(chat);

      return { success: true, spaces };
    } catch (err: any) {
      console.error('[GChatService] ListSpaces error:', err.message);
      return { success: false, error: err.message };
    }
  }
