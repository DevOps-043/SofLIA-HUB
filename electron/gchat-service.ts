/**
 * GChatService — Google Chat API integration.
 * Provides space listing, message send/read, and reaction capabilities.
 * Runs in the Electron main process.
 */
import { EventEmitter } from 'node:events';
import type { CalendarService } from './calendar-service';

// ─── Types ──────────────────────────────────────────────────────────

export interface ChatSpace {
  name: string;
  displayName: string;
  type: 'ROOM' | 'DM' | 'GROUP_CHAT' | string;
  spaceThreadingState?: string;
}

export interface ChatMessage {
  name: string;
  sender: { name: string; displayName: string; email?: string };
  createTime: string;
  text: string;
  threadName?: string;
}

// ─── GChatService ───────────────────────────────────────────────────

export class GChatService extends EventEmitter {
  private calendarService: CalendarService;

  constructor(calendarService: CalendarService) {
    super();
    this.calendarService = calendarService;
  }

  // ─── List Spaces ──────────────────────────────────────────────────

  async listSpaces(): Promise<{ success: boolean; spaces?: ChatSpace[]; error?: string }> {
    const auth = await this.calendarService.getGoogleAuth();
    if (!auth) return { success: false, error: 'Google no conectado' };

    try {
      const { google } = await import('googleapis');
      const chat = google.chat({ version: 'v1', auth });

      const response = await chat.spaces.list({ pageSize: 100 });

      const spaces: ChatSpace[] = (response.data.spaces || []).map((s: any) => ({
        name: s.name || '',
        displayName: s.displayName || '',
        type: s.type || '',
        spaceThreadingState: s.spaceThreadingState || undefined,
      }));

      return { success: true, spaces };
    } catch (err: any) {
      console.error('[GChatService] ListSpaces error:', err.message);
      return { success: false, error: err.message };
    }
  }

  // ─── Get Messages ─────────────────────────────────────────────────

  async getMessages(
    spaceName: string,
    maxResults?: number,
  ): Promise<{ success: boolean; messages?: ChatMessage[]; error?: string }> {
    const auth = await this.calendarService.getGoogleAuth();
    if (!auth) return { success: false, error: 'Google no conectado' };

    try {
      const { google } = await import('googleapis');
      const chat = google.chat({ version: 'v1', auth });

      const response = await chat.spaces.messages.list({
        parent: spaceName,
        pageSize: maxResults || 25,
        orderBy: 'createTime desc',
      });

      const messages: ChatMessage[] = (response.data.messages || []).map((m: any) => ({
        name: m.name || '',
        sender: {
          name: m.sender?.name || '',
          displayName: m.sender?.displayName || '',
          email: m.sender?.email || undefined,
        },
        createTime: m.createTime || '',
        text: m.text || '',
        threadName: m.thread?.name || undefined,
      }));

      return { success: true, messages };
    } catch (err: any) {
      console.error('[GChatService] GetMessages error:', err.message);
      return { success: false, error: err.message };
    }
  }

  // ─── Send Message ─────────────────────────────────────────────────

  async sendMessage(
    spaceName: string,
    text: string,
    threadName?: string,
  ): Promise<{ success: boolean; messageName?: string; error?: string }> {
    const auth = await this.calendarService.getGoogleAuth();
    if (!auth) return { success: false, error: 'Google no conectado' };

    try {
      const { google } = await import('googleapis');
      const chat = google.chat({ version: 'v1', auth });

      const requestBody: any = { text };
      if (threadName) {
        requestBody.thread = { name: threadName };
      }

      const response = await chat.spaces.messages.create({
        parent: spaceName,
        requestBody,
      });

      console.log(`[GChatService] Message sent: ${response.data.name}`);
      return { success: true, messageName: response.data.name || undefined };
    } catch (err: any) {
      console.error('[GChatService] SendMessage error:', err.message);
      return { success: false, error: err.message };
    }
  }

  // ─── Add Reaction ─────────────────────────────────────────────────

  async addReaction(
    messageName: string,
    emoji: string,
  ): Promise<{ success: boolean; error?: string }> {
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

  // ─── Get Space Members ────────────────────────────────────────────

  async getMembers(
    spaceName: string,
  ): Promise<{ success: boolean; members?: Array<{ name: string; displayName: string; email?: string }>; error?: string }> {
    const auth = await this.calendarService.getGoogleAuth();
    if (!auth) return { success: false, error: 'Google no conectado' };

    try {
      const { google } = await import('googleapis');
      const chat = google.chat({ version: 'v1', auth });

      const response = await chat.spaces.members.list({
        parent: spaceName,
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
}
