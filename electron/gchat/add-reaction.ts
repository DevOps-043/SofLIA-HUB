import type { GChatService } from '../gchat-service.ts';

export async function addReaction(this: GChatService, messageName: string, emoji: string): Promise<{ success: boolean; error?: string }> {
    const auth = await this.calendarService.getGoogleAuth();
    if (!auth) return { success: false, error: 'Google no conectado' };

    try {
      const { google } = await import('googleapis');
      const chat = google.chat({ version: 'v1', auth });

      await chat.spaces.messages.reactions.create({
        parent: messageName,
        requestBody: {
          emoji: { unicode: emoji },
        },
      });

      console.log(`[GChatService] Reaction added: ${emoji} on ${messageName}`);
      return { success: true };
    } catch (err: any) {
      console.error('[GChatService] AddReaction error:', err.message);
      return { success: false, error: err.message };
    }
  }
