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

  // ─── Security Validation ────────────────────────────────────────

  private isValidEmail(email: string): boolean {
    const strictEmailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    
    // Extraemos el correo si viene en formato "Nombre <correo@dominio.com>"
    const match = email.match(/<([^>]+)>/);
    const extractedEmail = match ? match[1].trim() : email.trim();
    
    // Verificamos el email con la regex estricta
    if (!strictEmailRegex.test(extractedEmail)) return false;

    // Prohibimos estrictamente comillas dobles y caracteres de escape inusuales (CR/LF)
    // en todo el string para prevenir Header Injection / SSRF (CVE-2025-13033)
    if (/[\r\n"]/.test(email)) return false;

    return true;
  }

  // ─── Send Email ─────────────────────────────────────────────────

  async sendEmail(params: SendEmailParams): Promise<{ success: boolean; messageId?: string; error?: string }> {
    // ─── Mitigación nativa SSRF/Injection (CVE-2025-13033) ────────
    try {
      const validateEmails = (emails: string[] | undefined, fieldName: string) => {
        if (!emails || !emails.length) return;
        for (const email of emails) {
          if (!this.isValidEmail(email)) {
            throw new Error(`Patrón de correo anómalo detectado en el campo '${fieldName}': Validación de seguridad fallida para "${email}". Formato inválido o caracteres peligrosos detectados.`);
          }
        }
      };

      validateEmails(params.to, 'to');
      validateEmails(params.cc, 'cc');
      validateEmails(params.bcc, 'bcc');
    } catch (validationErr: any) {
      console.error('[GmailService] Send error (Security):', validationErr.message);
      return { success: false, error: validationErr.message };
    }
    // ──────────────────────────────────────────────────────────────

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

  // ─── Create Label ──────────────────────────────────────────────

  async createLabel(name: string): Promise<{ success: boolean; label?: { id: string; name: string }; error?: string }> {
    const auth = await this.calendarService.getGoogleAuth();
    if (!auth) return { success: false, error: 'Google no conectado' };

    try {
      const { google } = await import('googleapis');
      const gmail = google.gmail({ version: 'v1', auth });

      const response = await gmail.users.labels.create({
        userId: 'me',
        requestBody: {
          name,
          labelListVisibility: 'labelShow',
          messageListVisibility: 'show',
        },
      });

      console.log(`[GmailService] Label created: ${response.data.id} (${name})`);
      return { success: true, label: { id: response.data.id || '', name: response.data.name || '' } };
    } catch (err: any) {
      // If label already exists, try to find and return it
      if (err.message?.includes('already exists') || err.code === 409) {
        const existing = await this.getLabels();
        const found = existing.labels?.find(l => l.name.toLowerCase() === name.toLowerCase());
        if (found) return { success: true, label: found };
      }
      console.error('[GmailService] CreateLabel error:', err.message);
      return { success: false, error: err.message };
    }
  }

  // ─── Batch Modify by Label ──────────────────────────────────────
  // Moves ALL messages from a label to INBOX (or applies add/remove labels), then optionally deletes the label

  async batchModifyByLabel(
    labelId: string,
    options?: { addLabels?: string[]; removeLabels?: string[]; deleteLabel?: boolean },
  ): Promise<{ success: boolean; processed: number; remaining: number; labelDeleted: boolean; error?: string }> {
    const auth = await this.calendarService.getGoogleAuth();
    if (!auth) return { success: false, processed: 0, remaining: 0, labelDeleted: false, error: 'Google no conectado' };

    try {
      const { google } = await import('googleapis');
      const gmail = google.gmail({ version: 'v1', auth });

      let totalProcessed = 0;
      let pageToken: string | undefined;

      // Process ALL messages in the label, paginating through them
      do {
        const listResponse = await gmail.users.messages.list({
          userId: 'me',
          labelIds: [labelId],
          maxResults: 100,
          pageToken,
        });

        const messageIds = (listResponse.data.messages || []).map(m => m.id).filter(Boolean) as string[];
        if (messageIds.length === 0) break;

        // Gmail API batchModify — modifies up to 1000 messages at once
        await gmail.users.messages.batchModify({
          userId: 'me',
          requestBody: {
            ids: messageIds,
            addLabelIds: options?.addLabels || ['INBOX'],
            removeLabelIds: options?.removeLabels || [labelId],
          },
        });

        totalProcessed += messageIds.length;
        pageToken = listResponse.data.nextPageToken || undefined;
        console.log(`[GmailService] Batch modified ${messageIds.length} messages (label: ${labelId}), total: ${totalProcessed}`);
      } while (pageToken);

      // Check if any messages remain
      const checkRemaining = await gmail.users.messages.list({
        userId: 'me',
        labelIds: [labelId],
        maxResults: 1,
      });
      const remaining = (checkRemaining.data.messages || []).length;

      // Optionally delete the label after emptying it
      let labelDeleted = false;
      if (options?.deleteLabel && remaining === 0) {
        try {
          await gmail.users.labels.delete({ userId: 'me', id: labelId });
          labelDeleted = true;
          console.log(`[GmailService] Label ${labelId} deleted after batch move`);
        } catch (delErr: any) {
          console.warn(`[GmailService] Could not delete label ${labelId}:`, delErr.message);
        }
      }

      return { success: true, processed: totalProcessed, remaining, labelDeleted };
    } catch (err: any) {
      console.error('[GmailService] BatchModifyByLabel error:', err.message);
      return { success: false, processed: 0, remaining: 0, labelDeleted: false, error: err.message };
    }
  }

  // ─── Empty and Delete ALL User Labels ────────────────────────────

  async emptyAndDeleteAllLabels(): Promise<{
    success: boolean;
    labelsProcessed: number;
    labelsDeleted: number;
    totalMessagesMovedToInbox: number;
    remainingLabels: string[];
    errors: string[];
  }> {
    const auth = await this.calendarService.getGoogleAuth();
    if (!auth) return { success: false, labelsProcessed: 0, labelsDeleted: 0, totalMessagesMovedToInbox: 0, remainingLabels: [], errors: ['Google no conectado'] };

    try {
      const { google } = await import('googleapis');
      const gmail = google.gmail({ version: 'v1', auth });

      // Get ALL labels
      const labelsResponse = await gmail.users.labels.list({ userId: 'me' });
      const allLabels = labelsResponse.data.labels || [];

      // Filter to user-created labels only (system labels start with uppercase keywords)
      const systemLabelIds = new Set([
        'INBOX', 'SPAM', 'TRASH', 'UNREAD', 'STARRED', 'IMPORTANT', 'SENT', 'DRAFT',
        'CATEGORY_PERSONAL', 'CATEGORY_SOCIAL', 'CATEGORY_PROMOTIONS', 'CATEGORY_UPDATES', 'CATEGORY_FORUMS',
        'CHAT',
      ]);
      const userLabels = allLabels.filter(l => l.id && !systemLabelIds.has(l.id) && l.type === 'user');

      console.log(`[GmailService] Found ${userLabels.length} user labels to process`);

      let labelsProcessed = 0;
      let labelsDeleted = 0;
      let totalMessages = 0;
      const errors: string[] = [];

      for (const label of userLabels) {
        if (!label.id) continue;
        try {
          // Move all messages from this label to INBOX
          let pageToken: string | undefined;
          let labelMsgCount = 0;
          do {
            const listResponse = await gmail.users.messages.list({
              userId: 'me',
              labelIds: [label.id],
              maxResults: 100,
              pageToken,
            });
            const messageIds = (listResponse.data.messages || []).map(m => m.id).filter(Boolean) as string[];
            if (messageIds.length === 0) break;

            await gmail.users.messages.batchModify({
              userId: 'me',
              requestBody: {
                ids: messageIds,
                addLabelIds: ['INBOX'],
                removeLabelIds: [label.id],
              },
            });
            labelMsgCount += messageIds.length;
            pageToken = listResponse.data.nextPageToken || undefined;
          } while (pageToken);

          totalMessages += labelMsgCount;
          labelsProcessed++;

          // Delete the label
          try {
            await gmail.users.labels.delete({ userId: 'me', id: label.id });
            labelsDeleted++;
            console.log(`[GmailService] Emptied (${labelMsgCount} msgs) and deleted label: ${label.name} (${label.id})`);
          } catch (delErr: any) {
            errors.push(`No se pudo eliminar "${label.name}": ${delErr.message}`);
            console.warn(`[GmailService] Could not delete label ${label.name}:`, delErr.message);
          }
        } catch (labelErr: any) {
          errors.push(`Error procesando "${label.name}": ${labelErr.message}`);
          console.error(`[GmailService] Error processing label ${label.name}:`, labelErr.message);
        }
      }

      // Verify: check remaining user labels
      const verifyResponse = await gmail.users.labels.list({ userId: 'me' });
      const remainingUserLabels = (verifyResponse.data.labels || [])
        .filter(l => l.id && !systemLabelIds.has(l.id) && l.type === 'user')
        .map(l => l.name || l.id || 'unknown');

      console.log(`[GmailService] Batch complete: ${labelsProcessed} processed, ${labelsDeleted} deleted, ${totalMessages} msgs moved, ${remainingUserLabels.length} remaining`);

      return {
        success: true,
        labelsProcessed,
        labelsDeleted,
        totalMessagesMovedToInbox: totalMessages,
        remainingLabels: remainingUserLabels,
        errors,
      };
    } catch (err: any) {
      console.error('[GmailService] EmptyAndDeleteAllLabels error:', err.message);
      return { success: false, labelsProcessed: 0, labelsDeleted: 0, totalMessagesMovedToInbox: 0, remainingLabels: [], errors: [err.message] };
    }
  }

  // ─── Delete Label ──────────────────────────────────────────────

  async deleteLabel(labelId: string): Promise<{ success: boolean; error?: string }> {
    const auth = await this.calendarService.getGoogleAuth();
    if (!auth) return { success: false, error: 'Google no conectado' };

    try {
      const { google } = await import('googleapis');
      const gmail = google.gmail({ version: 'v1', auth });

      await gmail.users.labels.delete({
        userId: 'me',
        id: labelId,
      });

      console.log(`[GmailService] Label deleted: ${labelId}`);
      return { success: true };
    } catch (err: any) {
      console.error('[GmailService] DeleteLabel error:', err.message);
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
