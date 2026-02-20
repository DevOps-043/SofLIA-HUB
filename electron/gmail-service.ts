/**
 * GmailService — Google Gmail API integration.
 * Provides email send, read, and management capabilities.
 * Runs in the Electron main process.
 */
import { EventEmitter } from 'node:events';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { CalendarService } from './calendar-service';

// ─── Types ──────────────────────────────────────────────────────────

export interface EmailMessage {
  id: string;
  threadId: string;
  from: string;
  to: string[];
  subject: string;
  snippet: string;
  body?: string;
  date: Date;
  labelIds: string[];
  isUnread: boolean;
}

export interface SendEmailParams {
  to: string[];
  subject: string;
  body: string;
  cc?: string[];
  bcc?: string[];
  isHtml?: boolean;
  attachmentPaths?: string[];
}

// ─── GmailService ───────────────────────────────────────────────────

export class GmailService extends EventEmitter {
  private calendarService: CalendarService;

  constructor(calendarService: CalendarService) {
    super();
    this.calendarService = calendarService;
  }

  // ─── Send Email ─────────────────────────────────────────────────

  async sendEmail(params: SendEmailParams): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const auth = await this.calendarService.getGoogleAuth();
    if (!auth) return { success: false, error: 'Google no conectado' };

    try {
      const { google } = await import('googleapis');
      const gmail = google.gmail({ version: 'v1', auth });

      let rawMessage: string;

      if (params.attachmentPaths?.length) {
        // ─── MIME multipart with attachments ──────────────────────
        const boundary = `----=_SofLIA_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        const contentType = params.isHtml ? 'text/html' : 'text/plain';
        const toLine = params.to.join(', ');

        const headerLines = [
          `To: ${toLine}`,
          ...(params.cc?.length ? [`Cc: ${params.cc.join(', ')}`] : []),
          ...(params.bcc?.length ? [`Bcc: ${params.bcc.join(', ')}`] : []),
          `Subject: ${params.subject}`,
          'MIME-Version: 1.0',
          `Content-Type: multipart/mixed; boundary="${boundary}"`,
          '',
          `--${boundary}`,
          `Content-Type: ${contentType}; charset=utf-8`,
          '',
          params.body,
        ];

        const parts: string[] = [headerLines.join('\r\n')];

        for (const filePath of params.attachmentPaths) {
          try {
            const fileData = await fs.readFile(filePath);
            const fileName = path.basename(filePath);
            const base64Data = fileData.toString('base64');
            const mimeType = this.getMimeType(fileName);

            parts.push([
              `--${boundary}`,
              `Content-Type: ${mimeType}; name="${fileName}"`,
              'Content-Transfer-Encoding: base64',
              `Content-Disposition: attachment; filename="${fileName}"`,
              '',
              base64Data,
            ].join('\r\n'));
          } catch (fileErr: any) {
            console.warn(`[GmailService] Could not attach ${filePath}: ${fileErr.message}`);
          }
        }

        parts.push(`--${boundary}--`);
        rawMessage = parts.join('\r\n');
      } else {
        // ─── Simple text email (no attachments) ───────────────────
        const contentType = params.isHtml ? 'text/html' : 'text/plain';
        const toLine = params.to.join(', ');
        rawMessage = [
          `To: ${toLine}`,
          ...(params.cc?.length ? [`Cc: ${params.cc.join(', ')}`] : []),
          ...(params.bcc?.length ? [`Bcc: ${params.bcc.join(', ')}`] : []),
          `Subject: ${params.subject}`,
          `Content-Type: ${contentType}; charset=utf-8`,
          '',
          params.body,
        ].join('\r\n');
      }

      const encodedMessage = Buffer.from(rawMessage).toString('base64url');

      const response = await gmail.users.messages.send({
        userId: 'me',
        requestBody: { raw: encodedMessage },
      });

      console.log(`[GmailService] Email sent: ${response.data.id}`);
      return { success: true, messageId: response.data.id || undefined };
    } catch (err: any) {
      console.error('[GmailService] Send error:', err.message);
      return { success: false, error: err.message };
    }
  }

  private getMimeType(fileName: string): string {
    const ext = path.extname(fileName).toLowerCase();
    const map: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.ppt': 'application/vnd.ms-powerpoint',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.zip': 'application/zip',
      '.txt': 'text/plain',
      '.csv': 'text/csv',
      '.html': 'text/html',
      '.mp3': 'audio/mpeg',
      '.mp4': 'video/mp4',
    };
    return map[ext] || 'application/octet-stream';
  }

  // ─── Get Messages (list) ────────────────────────────────────────

  async getMessages(options?: {
    maxResults?: number;
    query?: string;
    labelIds?: string[];
  }): Promise<{ success: boolean; messages?: EmailMessage[]; error?: string }> {
    const auth = await this.calendarService.getGoogleAuth();
    if (!auth) return { success: false, error: 'Google no conectado' };

    try {
      const { google } = await import('googleapis');
      const gmail = google.gmail({ version: 'v1', auth });

      const listResponse = await gmail.users.messages.list({
        userId: 'me',
        maxResults: options?.maxResults || 20,
        q: options?.query,
        labelIds: options?.labelIds,
      });

      const messageIds = listResponse.data.messages || [];
      if (messageIds.length === 0) return { success: true, messages: [] };

      // Fetch metadata for each message
      const messages: EmailMessage[] = [];
      for (const msg of messageIds) {
        if (!msg.id) continue;
        try {
          const detail = await gmail.users.messages.get({
            userId: 'me',
            id: msg.id,
            format: 'metadata',
            metadataHeaders: ['From', 'To', 'Subject', 'Date'],
          });

          const headers = detail.data.payload?.headers || [];
          const getHeader = (name: string) => headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

          messages.push({
            id: detail.data.id || '',
            threadId: detail.data.threadId || '',
            from: getHeader('From'),
            to: getHeader('To').split(',').map(s => s.trim()).filter(Boolean),
            subject: getHeader('Subject'),
            snippet: detail.data.snippet || '',
            date: new Date(getHeader('Date') || detail.data.internalDate || ''),
            labelIds: detail.data.labelIds || [],
            isUnread: (detail.data.labelIds || []).includes('UNREAD'),
          });
        } catch {
          // Skip messages that fail to fetch
        }
      }

      return { success: true, messages };
    } catch (err: any) {
      console.error('[GmailService] GetMessages error:', err.message);
      return { success: false, error: err.message };
    }
  }

  // ─── Get Single Message (full) ──────────────────────────────────

  async getMessage(messageId: string): Promise<{ success: boolean; message?: EmailMessage; error?: string }> {
    const auth = await this.calendarService.getGoogleAuth();
    if (!auth) return { success: false, error: 'Google no conectado' };

    try {
      const { google } = await import('googleapis');
      const gmail = google.gmail({ version: 'v1', auth });

      const detail = await gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full',
      });

      const headers = detail.data.payload?.headers || [];
      const getHeader = (name: string) => headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

      // Extract body
      let body = '';
      const payload = detail.data.payload;
      if (payload?.body?.data) {
        body = Buffer.from(payload.body.data, 'base64url').toString('utf-8');
      } else if (payload?.parts) {
        // Look for text/plain or text/html parts
        const textPart = payload.parts.find(p => p.mimeType === 'text/plain');
        const htmlPart = payload.parts.find(p => p.mimeType === 'text/html');
        const part = textPart || htmlPart;
        if (part?.body?.data) {
          body = Buffer.from(part.body.data, 'base64url').toString('utf-8');
        }
      }

      const message: EmailMessage = {
        id: detail.data.id || '',
        threadId: detail.data.threadId || '',
        from: getHeader('From'),
        to: getHeader('To').split(',').map(s => s.trim()).filter(Boolean),
        subject: getHeader('Subject'),
        snippet: detail.data.snippet || '',
        body,
        date: new Date(getHeader('Date') || detail.data.internalDate || ''),
        labelIds: detail.data.labelIds || [],
        isUnread: (detail.data.labelIds || []).includes('UNREAD'),
      };

      return { success: true, message };
    } catch (err: any) {
      console.error('[GmailService] GetMessage error:', err.message);
      return { success: false, error: err.message };
    }
  }

  // ─── Modify Labels ──────────────────────────────────────────────

  async modifyLabels(
    messageId: string,
    addLabels?: string[],
    removeLabels?: string[],
  ): Promise<{ success: boolean; error?: string }> {
    const auth = await this.calendarService.getGoogleAuth();
    if (!auth) return { success: false, error: 'Google no conectado' };

    try {
      const { google } = await import('googleapis');
      const gmail = google.gmail({ version: 'v1', auth });

      await gmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        requestBody: {
          addLabelIds: addLabels || [],
          removeLabelIds: removeLabels || [],
        },
      });

      console.log(`[GmailService] Labels modified: ${messageId}`);
      return { success: true };
    } catch (err: any) {
      console.error('[GmailService] ModifyLabels error:', err.message);
      return { success: false, error: err.message };
    }
  }

  // ─── Trash Message ──────────────────────────────────────────────

  async trashMessage(messageId: string): Promise<{ success: boolean; error?: string }> {
    const auth = await this.calendarService.getGoogleAuth();
    if (!auth) return { success: false, error: 'Google no conectado' };

    try {
      const { google } = await import('googleapis');
      const gmail = google.gmail({ version: 'v1', auth });

      await gmail.users.messages.trash({
        userId: 'me',
        id: messageId,
      });

      console.log(`[GmailService] Message trashed: ${messageId}`);
      return { success: true };
    } catch (err: any) {
      console.error('[GmailService] Trash error:', err.message);
      return { success: false, error: err.message };
    }
  }

  // ─── Get Labels ─────────────────────────────────────────────────

  async getLabels(): Promise<{ success: boolean; labels?: Array<{ id: string; name: string }>; error?: string }> {
    const auth = await this.calendarService.getGoogleAuth();
    if (!auth) return { success: false, error: 'Google no conectado' };

    try {
      const { google } = await import('googleapis');
      const gmail = google.gmail({ version: 'v1', auth });

      const response = await gmail.users.labels.list({ userId: 'me' });
      const labels = (response.data.labels || []).map(l => ({
        id: l.id || '',
        name: l.name || '',
      }));

      return { success: true, labels };
    } catch (err: any) {
      console.error('[GmailService] GetLabels error:', err.message);
      return { success: false, error: err.message };
    }
  }
}
