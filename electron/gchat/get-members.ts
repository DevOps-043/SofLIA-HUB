import type { GChatService } from '../gchat-service.ts';

export async function getMembers(this: GChatService, spaceName: string): Promise<{ success: boolean; members?: Array<{ name: string; displayName: string; email?: string }>; error?: string }> {
    const auth = await this.calendarService.getGoogleAuth();
    if (!auth) return { success: false, error: 'Google no conectado' };

    try {
      const { google } = await import('googleapis');
      const chat = google.chat({ version: 'v1', auth });
      const resolved = await this.resolveSpaceReference(chat, spaceName);

      const response = await chat.spaces.members.list({
        parent: resolved.name,
        pageSize: 100,
      });

      const members = (response.data.memberships || []).map((m: any) => ({
        name: m.member?.name || '',
        displayName: m.member?.displayName || '',
        email: m.member?.email || undefined,
      }));

      return { success: true, members };
    } catch (err: any) {
      console.error('[GChatService] GetMembers error:', err.message);
      return { success: false, error: err.message };
    }
  }
