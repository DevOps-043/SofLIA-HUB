/**
 * GmailService - Google Gmail API integration.
 * Runs in the Electron main process.
 */
import { EventEmitter } from 'node:events';
import fs from 'node:fs/promises';
import path from 'node:path';
import { app } from 'electron';
import type { CalendarService } from './calendar-service';

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

export interface GetMessagesOptions {
  maxResults?: number;
  query?: string;
  labelIds?: string[];
  pageToken?: string;
}

export interface GetMessagesResult {
  [key: string]: unknown;
  success: boolean;
  messages?: EmailMessage[];
  nextPageToken?: string;
  resultSizeEstimate?: number;
  error?: string;
}

export interface GmailOrganizationPreviewOptions {
  query?: string;
  maxMessages?: number;
  minGroupSize?: number;
  removeFromInbox?: boolean;
  pageLimit?: number;
}

export interface GmailOrganizationPreviewGroup {
  groupKey: string;
  labelName: string;
  count: number;
  domains: string[];
  sampleSenders: string[];
  sampleSubjects: string[];
  existingLabelId?: string;
}

export interface GmailOrganizationPreviewResult {
  [key: string]: unknown;
  success: boolean;
  planId?: string;
  queryUsed?: string;
  scannedMessages?: number;
  groupedMessages?: number;
  uncategorizedMessages?: number;
  truncated?: boolean;
  removeFromInbox?: boolean;
  groups?: GmailOrganizationPreviewGroup[];
  error?: string;
}

export interface GmailOrganizationApplyResult {
  [key: string]: unknown;
  success: boolean;
  planId: string;
  groupsApplied: number;
  messagesLabeled: number;
  removeFromInbox: boolean;
  labelsCreated: Array<{ id: string; name: string }>;
  labelsReused: Array<{ id: string; name: string }>;
  error?: string;
}

interface GmailLabelRecord {
  id: string;
  name: string;
}

export interface GmailOrganizationUndoResult {
  [key: string]: unknown;
  success: boolean;
  planId: string;
  messagesRestored: number;
  labelsDeleted: number;
  error?: string;
}

interface GmailOrganizationMessageSnapshot {
  id: string;
  from: string;
  subject: string;
  labelIds: string[];
}

interface GmailOrganizationPlanGroup extends GmailOrganizationPreviewGroup {
  messageIds: string[];
}

interface GmailOrganizationMessageChange {
  addedLabelIds: string[];
  removedLabelIds: string[];
}

interface GmailOrganizationPlanRecord {
  id: string;
  createdAt: string;
  queryUsed: string;
  removeFromInbox: boolean;
  minGroupSize: number;
  scannedMessages: number;
  truncated: boolean;
  status: 'preview' | 'applied' | 'undone';
  groups: GmailOrganizationPlanGroup[];
  messages: GmailOrganizationMessageSnapshot[];
  applyResult?: {
    appliedAt: string;
    labelsCreated: Array<{ id: string; name: string }>;
    labelsReused: Array<{ id: string; name: string }>;
    groupLabelIds: Record<string, string>;
    messageChanges: Record<string, GmailOrganizationMessageChange>;
    removeFromInbox: boolean;
  };
  undoneAt?: string;
}

type GmailClient = {
  users: {
    messages: {
      send: (args: any) => Promise<any>;
      list: (args: any) => Promise<any>;
      get: (args: any) => Promise<any>;
      modify: (args: any) => Promise<any>;
      batchModify: (args: any) => Promise<any>;
      trash: (args: any) => Promise<any>;
    };
    labels: {
      list: (args: any) => Promise<any>;
      create: (args: any) => Promise<any>;
      delete: (args: any) => Promise<any>;
    };
  };
};

const SECOND_LEVEL_TLDS = new Set([
  'com.mx',
  'com.br',
  'com.ar',
  'co.uk',
  'org.uk',
  'gov.uk',
  'com.au',
  'com.co',
  'com.pe',
  'com.ve',
]);

const GENERIC_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'yahoo.com',
  'icloud.com',
  'me.com',
  'proton.me',
  'protonmail.com',
  'aol.com',
]);

const BRAND_LABELS = new Map<string, string>([
  ['openai.com', 'OpenAI'],
  ['anthropic.com', 'Anthropic'],
  ['google.com', 'Google'],
  ['github.com', 'GitHub'],
  ['microsoft.com', 'Microsoft'],
  ['supabase.com', 'Supabase'],
  ['deeplearning.ai', 'DeepLearning.AI'],
  ['notion.so', 'Notion'],
  ['stripe.com', 'Stripe'],
  ['slack.com', 'Slack'],
  ['zoom.us', 'Zoom'],
]);

export class GmailService extends EventEmitter {
  private calendarService: CalendarService;

  constructor(calendarService: CalendarService) {
    super();
    this.calendarService = calendarService;
  }

  private isValidEmail(email: string): boolean {
    const strictEmailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    const match = email.match(/<([^>]+)>/);
    const extractedEmail = match ? match[1].trim() : email.trim();

    if (!strictEmailRegex.test(extractedEmail)) return false;
    if (/[\r\n"]/.test(email)) return false;

    return true;
  }

  private async getClient(): Promise<{ client?: GmailClient; error?: string }> {
    const auth = await this.calendarService.getGoogleAuth();
    if (!auth) return { error: 'Google no conectado' };

    const { google } = await import('googleapis');
    return { client: google.gmail({ version: 'v1', auth }) as GmailClient };
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

  private decodeBody(data?: string | null): string {
    if (!data) return '';
    try {
      return Buffer.from(data, 'base64url').toString('utf-8');
    } catch {
      return '';
    }
  }

  private extractBodyFromPart(part: any): string {
    if (!part) return '';

    if (part.mimeType === 'text/plain' && part.body?.data) {
      return this.decodeBody(part.body.data);
    }

    if (part.parts?.length) {
      for (const child of part.parts) {
        const nested = this.extractBodyFromPart(child);
        if (nested) return nested;
      }
    }

    if (part.mimeType === 'text/html' && part.body?.data) {
      return this.decodeBody(part.body.data);
    }

    if (part.body?.data) {
      return this.decodeBody(part.body.data);
    }

    return '';
  }

  private buildEmailMessage(detail: any): EmailMessage {
    const headers = detail.data.payload?.headers || [];
    const getHeader = (name: string) => headers.find((h: any) => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

    return {
      id: detail.data.id || '',
      threadId: detail.data.threadId || '',
      from: getHeader('From'),
      to: getHeader('To').split(',').map((s: string) => s.trim()).filter(Boolean),
      subject: getHeader('Subject'),
      snippet: detail.data.snippet || '',
      body: this.extractBodyFromPart(detail.data.payload),
      date: new Date(getHeader('Date') || detail.data.internalDate || ''),
      labelIds: detail.data.labelIds || [],
      isUnread: (detail.data.labelIds || []).includes('UNREAD'),
    };
  }

  private getPlanDirectory(): string {
    return path.join(app.getPath('userData'), 'gmail-organization-plans');
  }

  private async ensurePlanDirectory(): Promise<void> {
    await fs.mkdir(this.getPlanDirectory(), { recursive: true });
  }

  private getPlanPath(planId: string): string {
    return path.join(this.getPlanDirectory(), `${planId}.json`);
  }

  private async saveOrganizationPlan(plan: GmailOrganizationPlanRecord): Promise<void> {
    await this.ensurePlanDirectory();
    await fs.writeFile(this.getPlanPath(plan.id), JSON.stringify(plan, null, 2), 'utf-8');
  }

  private async loadOrganizationPlan(planId: string): Promise<GmailOrganizationPlanRecord> {
    const raw = await fs.readFile(this.getPlanPath(planId), 'utf-8');
    return JSON.parse(raw) as GmailOrganizationPlanRecord;
  }

  private async findLatestAppliedOrganizationPlanId(): Promise<string | null> {
    await this.ensurePlanDirectory();
    const entries = await fs.readdir(this.getPlanDirectory(), { withFileTypes: true });
    const plans: GmailOrganizationPlanRecord[] = [];

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.json')) {
        continue;
      }

      try {
        const raw = await fs.readFile(path.join(this.getPlanDirectory(), entry.name), 'utf-8');
        const parsed = JSON.parse(raw) as GmailOrganizationPlanRecord;
        if (parsed.status === 'applied' && parsed.applyResult?.appliedAt) {
          plans.push(parsed);
        }
      } catch {
        // Ignore malformed plan files and continue.
      }
    }

    plans.sort((left, right) => {
      const leftTime = new Date(left.applyResult?.appliedAt || left.createdAt).getTime();
      const rightTime = new Date(right.applyResult?.appliedAt || right.createdAt).getTime();
      return rightTime - leftTime;
    });

    return plans[0]?.id || null;
  }

  private extractEmailAddress(rawValue: string): string {
    const angleMatch = rawValue.match(/<([^>]+)>/);
    if (angleMatch?.[1]) {
      return angleMatch[1].trim().toLowerCase();
    }

    const directMatch = rawValue.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    return directMatch?.[0]?.trim().toLowerCase() || '';
  }

  private cleanSenderDisplayName(rawValue: string, email: string): string {
    const withoutEmail = rawValue.replace(/<[^>]+>/g, '');
    const withoutQuotes = withoutEmail.replace(/^["'\s]+|["'\s]+$/g, '');
    const withoutViaSuffix = withoutQuotes
      .replace(/\((via|mediante)[^)]+\)/gi, '')
      .replace(/\b(via|mediante)\s+.+$/i, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (withoutViaSuffix) {
      return withoutViaSuffix;
    }

    return email.split('@')[0] || rawValue.trim();
  }

  private getBaseDomain(domain: string): string {
    const cleanDomain = domain.toLowerCase().trim();
    const parts = cleanDomain.split('.').filter(Boolean);
    if (parts.length <= 2) {
      return cleanDomain;
    }

    const lastTwo = parts.slice(-2).join('.');
    if (SECOND_LEVEL_TLDS.has(lastTwo) && parts.length >= 3) {
      return parts.slice(-3).join('.');
    }

    return parts.slice(-2).join('.');
  }

  private normalizeGroupingKey(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private toTitleCase(value: string): string {
    return value
      .split(/[\s._-]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ');
  }

  private sanitizeLabelName(value: string): string {
    const trimmed = value
      .replace(/[<>:"/\\|?*]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return trimmed.slice(0, 225) || 'Otros';
  }

  private inferOrganizationLabel(displayName: string, baseDomain: string): { groupKey: string; labelName: string; domain?: string } {
    const cleanedDisplay = this.cleanSenderDisplayName(displayName, '');
    const lowerDisplay = cleanedDisplay.toLowerCase();
    const brandKey = baseDomain.split('.')[0] || baseDomain;
    const brandLabel = BRAND_LABELS.get(baseDomain) || BRAND_LABELS.get(brandKey) || this.toTitleCase(brandKey);

    const looksPersonLike =
      cleanedDisplay.split(/\s+/).length >= 2 &&
      !/\b(google|workspace|alerts|billing|team|support|notifications?|docs|drive|calendar)\b/i.test(lowerDisplay);

    if ((baseDomain === 'google.com' || GENERIC_EMAIL_DOMAINS.has(baseDomain)) && looksPersonLike) {
      const personLabel = this.sanitizeLabelName(cleanedDisplay);
      return {
        groupKey: `person:${this.normalizeGroupingKey(personLabel)}`,
        labelName: personLabel,
      };
    }

    if (cleanedDisplay && lowerDisplay.includes(brandLabel.toLowerCase())) {
      return {
        groupKey: `domain:${baseDomain}`,
        labelName: brandLabel,
        domain: baseDomain,
      };
    }

    if (cleanedDisplay && !GENERIC_EMAIL_DOMAINS.has(baseDomain) && cleanedDisplay.length <= 32 && !/\b(alerts|billing|team|support|notifications?)\b/i.test(lowerDisplay)) {
      return {
        groupKey: `domain:${baseDomain}`,
        labelName: this.sanitizeLabelName(cleanedDisplay),
        domain: baseDomain,
      };
    }

    return {
      groupKey: `domain:${baseDomain}`,
      labelName: this.sanitizeLabelName(brandLabel),
      domain: baseDomain,
    };
  }

  private inferMessageGrouping(fromHeader: string): { groupKey: string; labelName: string; domain?: string; senderSample: string } {
    const email = this.extractEmailAddress(fromHeader);
    const displayName = this.cleanSenderDisplayName(fromHeader, email);
    const domain = email.includes('@') ? email.split('@')[1] : '';
    const baseDomain = domain ? this.getBaseDomain(domain) : '';

    if (baseDomain && !GENERIC_EMAIL_DOMAINS.has(baseDomain)) {
      return {
        ...this.inferOrganizationLabel(displayName, baseDomain),
        senderSample: displayName || email || fromHeader,
      };
    }

    const fallbackLabel = this.sanitizeLabelName(displayName || email.split('@')[0] || 'Otros');
    return {
      groupKey: `person:${this.normalizeGroupingKey(fallbackLabel)}`,
      labelName: fallbackLabel,
      domain: baseDomain || undefined,
      senderSample: displayName || email || fromHeader,
    };
  }

  private chunkArray<T>(items: T[], chunkSize: number): T[][] {
    const result: T[][] = [];
    for (let index = 0; index < items.length; index += chunkSize) {
      result.push(items.slice(index, index + chunkSize));
    }
    return result;
  }

  private async batchModifyMessageIds(
    gmail: GmailClient,
    messageIds: string[],
    addLabelIds: string[],
    removeLabelIds: string[],
  ): Promise<void> {
    for (const batch of this.chunkArray(messageIds, 100)) {
      await gmail.users.messages.batchModify({
        userId: 'me',
        requestBody: {
          ids: batch,
          addLabelIds,
          removeLabelIds,
        },
      });
    }
  }

  private async drainLabelMessages(
    gmail: GmailClient,
    labelId: string,
    options?: { addLabels?: string[]; removeLabels?: string[] },
  ): Promise<{ processed: number; remaining: number }> {
    let totalProcessed = 0;
    let iterations = 0;

    while (iterations < 500) {
      const listResponse = await gmail.users.messages.list({
        userId: 'me',
        labelIds: [labelId],
        maxResults: 100,
      });

      const messageIds = (listResponse.data.messages || []).map((m: any) => m.id).filter(Boolean) as string[];
      if (messageIds.length === 0) break;

      await gmail.users.messages.batchModify({
        userId: 'me',
        requestBody: {
          ids: messageIds,
          addLabelIds: options?.addLabels || ['INBOX'],
          removeLabelIds: options?.removeLabels || [labelId],
        },
      });

      totalProcessed += messageIds.length;
      iterations++;
      console.log(`[GmailService] Batch modified ${messageIds.length} messages (label: ${labelId}), total: ${totalProcessed}`);
    }

    if (iterations >= 500) {
      throw new Error(`Se alcanzo el limite de iteraciones vaciando la etiqueta ${labelId}`);
    }

    const remainingResponse = await gmail.users.messages.list({
      userId: 'me',
      labelIds: [labelId],
      maxResults: 1,
    });

    return {
      processed: totalProcessed,
      remaining: (remainingResponse.data.messages || []).length,
    };
  }

  async sendEmail(params: SendEmailParams): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const validateEmails = (emails: string[] | undefined, fieldName: string) => {
        if (!emails || !emails.length) return;
        for (const email of emails) {
          if (!this.isValidEmail(email)) {
            throw new Error(`Patron de correo anomalo detectado en el campo '${fieldName}': validacion de seguridad fallida para "${email}".`);
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

    const { client: gmail, error } = await this.getClient();
    if (!gmail) return { success: false, error };

    try {
      let rawMessage: string;

      if (params.attachmentPaths?.length) {
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

  async getMessages(options?: GetMessagesOptions): Promise<GetMessagesResult> {
    const { client: gmail, error } = await this.getClient();
    if (!gmail) return { success: false, error };

    try {
      const maxResults = Math.max(1, Math.min(options?.maxResults || 20, 100));
      const listResponse = await gmail.users.messages.list({
        userId: 'me',
        maxResults,
        q: options?.query,
        labelIds: options?.labelIds,
        pageToken: options?.pageToken,
      });

      const messageIds = listResponse.data.messages || [];
      if (messageIds.length === 0) {
        return {
          success: true,
          messages: [],
          nextPageToken: listResponse.data.nextPageToken || undefined,
          resultSizeEstimate: listResponse.data.resultSizeEstimate || 0,
        };
      }

      const details = await Promise.allSettled(
        messageIds
          .map((msg: any) => msg.id)
          .filter(Boolean)
          .map((id: string) => gmail.users.messages.get({
            userId: 'me',
            id,
            format: 'metadata',
            metadataHeaders: ['From', 'To', 'Subject', 'Date'],
          })),
      );

      const messages = details
        .filter((detail): detail is PromiseFulfilledResult<any> => detail.status === 'fulfilled')
        .map(detail => this.buildEmailMessage(detail.value));

      return {
        success: true,
        messages,
        nextPageToken: listResponse.data.nextPageToken || undefined,
        resultSizeEstimate: listResponse.data.resultSizeEstimate || messages.length,
      };
    } catch (err: any) {
      console.error('[GmailService] GetMessages error:', err.message);
      return { success: false, error: err.message };
    }
  }

  async getMessage(messageId: string): Promise<{ success: boolean; message?: EmailMessage; error?: string }> {
    const { client: gmail, error } = await this.getClient();
    if (!gmail) return { success: false, error };

    try {
      const detail = await gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full',
      });

      return { success: true, message: this.buildEmailMessage(detail) };
    } catch (err: any) {
      console.error('[GmailService] GetMessage error:', err.message);
      return { success: false, error: err.message };
    }
  }

  async previewOrganizationPlan(options?: GmailOrganizationPreviewOptions): Promise<GmailOrganizationPreviewResult> {
    const queryUsed = options?.query?.trim() || 'in:inbox';
    const maxMessages = Math.max(25, Math.min(options?.maxMessages || 250, 1000));
    const minGroupSize = Math.max(1, Math.min(options?.minGroupSize || 2, 20));
    const pageLimit = Math.max(1, Math.min(options?.pageLimit || 20, 50));
    const removeFromInbox = options?.removeFromInbox !== false;

    try {
      const labelsResult = await this.getLabels();
      if (!labelsResult.success || !labelsResult.labels) {
        return { success: false, error: labelsResult.error || 'No se pudieron leer las etiquetas de Gmail.' };
      }

      const existingLabelsByName = new Map(
        labelsResult.labels.map((label) => [label.name.toLowerCase(), label.id]),
      );

      let pageToken: string | undefined;
      let pageCount = 0;
      const messages: GmailOrganizationMessageSnapshot[] = [];

      while (messages.length < maxMessages && pageCount < pageLimit) {
        const pageResult = await this.getMessages({
          query: queryUsed,
          maxResults: Math.min(50, maxMessages - messages.length),
          pageToken,
        });

        if (!pageResult.success) {
          return { success: false, error: pageResult.error || 'No se pudieron leer mensajes de Gmail.' };
        }

        for (const message of pageResult.messages || []) {
          messages.push({
            id: message.id,
            from: message.from,
            subject: message.subject,
            labelIds: message.labelIds || [],
          });
        }

        pageToken = pageResult.nextPageToken;
        pageCount += 1;

        if (!pageToken) {
          break;
        }
      }

      const groupMap = new Map<
        string,
        {
          groupKey: string;
          labelName: string;
          domains: Set<string>;
          senders: Set<string>;
          subjects: Set<string>;
          messageIds: string[];
          existingLabelId?: string;
        }
      >();

      for (const message of messages) {
        const grouping = this.inferMessageGrouping(message.from);
        const groupKey = grouping.groupKey;
        if (!groupMap.has(groupKey)) {
          const labelName = this.sanitizeLabelName(grouping.labelName);
          groupMap.set(groupKey, {
            groupKey,
            labelName,
            domains: new Set<string>(),
            senders: new Set<string>(),
            subjects: new Set<string>(),
            messageIds: [],
            existingLabelId: existingLabelsByName.get(labelName.toLowerCase()),
          });
        }

        const group = groupMap.get(groupKey)!;
        group.messageIds.push(message.id);
        if (grouping.domain) {
          group.domains.add(grouping.domain);
        }
        group.senders.add(grouping.senderSample);
        if (message.subject) {
          group.subjects.add(message.subject);
        }
      }

      const groups = Array.from(groupMap.values())
        .filter((group) => group.messageIds.length >= minGroupSize)
        .map<GmailOrganizationPlanGroup>((group) => ({
          groupKey: group.groupKey,
          labelName: group.labelName,
          count: group.messageIds.length,
          domains: Array.from(group.domains).slice(0, 5),
          sampleSenders: Array.from(group.senders).slice(0, 5),
          sampleSubjects: Array.from(group.subjects).slice(0, 5),
          existingLabelId: group.existingLabelId,
          messageIds: group.messageIds,
        }))
        .sort((left, right) => right.count - left.count || left.labelName.localeCompare(right.labelName));

      const groupedMessageIds = new Set(groups.flatMap((group) => group.messageIds));
      const groupedMessages = groupedMessageIds.size;
      const uncategorizedMessages = Math.max(0, messages.length - groupedMessages);
      const planId = `gmail-plan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      const planRecord: GmailOrganizationPlanRecord = {
        id: planId,
        createdAt: new Date().toISOString(),
        queryUsed,
        removeFromInbox,
        minGroupSize,
        scannedMessages: messages.length,
        truncated: Boolean(pageToken),
        status: 'preview',
        groups,
        messages,
      };

      await this.saveOrganizationPlan(planRecord);

      return {
        success: true,
        planId,
        queryUsed,
        scannedMessages: messages.length,
        groupedMessages,
        uncategorizedMessages,
        truncated: Boolean(pageToken),
        removeFromInbox,
        groups: groups.map((group) => ({
          groupKey: group.groupKey,
          labelName: group.labelName,
          count: group.count,
          domains: group.domains,
          sampleSenders: group.sampleSenders,
          sampleSubjects: group.sampleSubjects,
          existingLabelId: group.existingLabelId,
        })),
      };
    } catch (err: any) {
      console.error('[GmailService] PreviewOrganizationPlan error:', err.message);
      return { success: false, error: err.message };
    }
  }

  async applyOrganizationPlan(planId: string, options?: { removeFromInbox?: boolean }): Promise<GmailOrganizationApplyResult> {
    const { client: gmail, error } = await this.getClient();
    if (!gmail) {
      return {
        success: false,
        planId,
        groupsApplied: 0,
        messagesLabeled: 0,
        removeFromInbox: options?.removeFromInbox !== false,
        labelsCreated: [],
        labelsReused: [],
        error,
      };
    }

    try {
      const plan = await this.loadOrganizationPlan(planId);
      const removeFromInbox = options?.removeFromInbox ?? plan.removeFromInbox;
      const existingLabelsResult = await this.getLabels();
      if (!existingLabelsResult.success || !existingLabelsResult.labels) {
        throw new Error(existingLabelsResult.error || 'No se pudieron leer las etiquetas antes de aplicar el plan.');
      }

      const labelsByName = new Map(
        existingLabelsResult.labels.map((label) => [label.name.toLowerCase(), label]),
      );
      const messageMap = new Map(plan.messages.map((message) => [message.id, message]));
      const messageChanges: Record<string, GmailOrganizationMessageChange> = {};
      const labelsCreated: Array<{ id: string; name: string }> = [];
      const labelsReused: Array<{ id: string; name: string }> = [];
      const groupLabelIds: Record<string, string> = {};
      let messagesLabeled = 0;

      for (const group of plan.groups) {
        let label = labelsByName.get(group.labelName.toLowerCase());
        if (!label) {
          const createResult = await this.createLabel(group.labelName);
          if (!createResult.success || !createResult.label) {
            throw new Error(createResult.error || `No se pudo crear la etiqueta ${group.labelName}.`);
          }
          label = createResult.label;
          labelsByName.set(label.name.toLowerCase(), label);
          labelsCreated.push(label);
        } else if (!labelsReused.some((item) => item.id === label!.id)) {
          labelsReused.push(label);
        }

        groupLabelIds[group.groupKey] = label.id;
        const removeLabelIds = removeFromInbox ? ['INBOX'] : [];

        await this.batchModifyMessageIds(gmail, group.messageIds, [label.id], removeLabelIds);
        messagesLabeled += group.messageIds.length;

        for (const messageId of group.messageIds) {
          const snapshot = messageMap.get(messageId);
          if (!snapshot) continue;
          const addedLabelIds = snapshot.labelIds.includes(label.id) ? [] : [label.id];
          const removedLabelIds = removeFromInbox && snapshot.labelIds.includes('INBOX') ? ['INBOX'] : [];
          messageChanges[messageId] = { addedLabelIds, removedLabelIds };
        }
      }

      plan.status = 'applied';
      plan.removeFromInbox = removeFromInbox;
      plan.applyResult = {
        appliedAt: new Date().toISOString(),
        labelsCreated,
        labelsReused,
        groupLabelIds,
        messageChanges,
        removeFromInbox,
      };

      await this.saveOrganizationPlan(plan);

      return {
        success: true,
        planId,
        groupsApplied: plan.groups.length,
        messagesLabeled,
        removeFromInbox,
        labelsCreated,
        labelsReused,
      };
    } catch (err: any) {
      console.error('[GmailService] ApplyOrganizationPlan error:', err.message);
      return {
        success: false,
        planId,
        groupsApplied: 0,
        messagesLabeled: 0,
        removeFromInbox: options?.removeFromInbox !== false,
        labelsCreated: [],
        labelsReused: [],
        error: err.message,
      };
    }
  }

  async undoOrganizationPlan(planId?: string): Promise<GmailOrganizationUndoResult> {
    try {
      const resolvedPlanId = planId || await this.findLatestAppliedOrganizationPlanId();
      if (!resolvedPlanId) {
        return { success: false, planId: planId || '', messagesRestored: 0, labelsDeleted: 0, error: 'No encontre un plan de organización aplicado para revertir.' };
      }

      const plan = await this.loadOrganizationPlan(resolvedPlanId);
      if (!plan.applyResult) {
        return { success: false, planId: resolvedPlanId, messagesRestored: 0, labelsDeleted: 0, error: 'Ese plan todavia no ha sido aplicado.' };
      }

      let messagesRestored = 0;
      for (const [messageId, change] of Object.entries(plan.applyResult.messageChanges)) {
        const result = await this.modifyLabels(messageId, change.removedLabelIds, change.addedLabelIds);
        if (!result.success) {
          throw new Error(result.error || `No se pudo revertir el mensaje ${messageId}.`);
        }
        messagesRestored += 1;
      }

      let labelsDeleted = 0;
      for (const label of plan.applyResult.labelsCreated) {
        const labelMessages = await this.getMessages({ labelIds: [label.id], maxResults: 1 });
        if (labelMessages.success && (labelMessages.messages?.length || 0) === 0) {
          const deleteResult = await this.deleteLabel(label.id);
          if (deleteResult.success) {
            labelsDeleted += 1;
          }
        }
      }

      plan.status = 'undone';
      plan.undoneAt = new Date().toISOString();
      await this.saveOrganizationPlan(plan);

      return {
        success: true,
        planId: resolvedPlanId,
        messagesRestored,
        labelsDeleted,
      };
    } catch (err: any) {
      console.error('[GmailService] UndoOrganizationPlan error:', err.message);
      return { success: false, planId: planId || '', messagesRestored: 0, labelsDeleted: 0, error: err.message };
    }
  }

  async modifyLabels(
    messageId: string,
    addLabels?: string[],
    removeLabels?: string[],
  ): Promise<{ success: boolean; error?: string }> {
    const { client: gmail, error } = await this.getClient();
    if (!gmail) return { success: false, error };

    try {
      const addLabelIds = await this.resolveLabelIds(addLabels, { createMissing: true });
      const removeLabelIds = await this.resolveLabelIds(removeLabels, { createMissing: false });

      await gmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        requestBody: {
          addLabelIds,
          removeLabelIds,
        },
      });

      console.log(`[GmailService] Labels modified: ${messageId}`);
      return { success: true };
    } catch (err: any) {
      console.error('[GmailService] ModifyLabels error:', err.message);
      return { success: false, error: err.message };
    }
  }

  private async resolveLabelIds(
    labels: string[] | undefined,
    options: { createMissing: boolean },
  ): Promise<string[]> {
    const requested = Array.isArray(labels)
      ? labels.map((item) => String(item || '').trim()).filter(Boolean)
      : [];
    if (requested.length === 0) {
      return [];
    }

    const labelsResult = await this.getLabels();
    if (!labelsResult.success || !labelsResult.labels) {
      throw new Error(labelsResult.error || 'No se pudieron leer las etiquetas de Gmail.');
    }

    const knownLabels = [...labelsResult.labels];
    const resolvedIds: string[] = [];
    for (const requestedLabel of requested) {
      const resolved = this.findLabelId(knownLabels, requestedLabel);
      if (resolved) {
        resolvedIds.push(resolved);
        continue;
      }

      if (!options.createMissing) {
        console.warn(`[GmailService] Label not found while resolving removeLabels: ${requestedLabel}`);
        continue;
      }

      const created = await this.createLabel(requestedLabel);
      if (!created.success || !created.label?.id) {
        throw new Error(created.error || `No se pudo crear la etiqueta ${requestedLabel}.`);
      }
      knownLabels.push(created.label);
      resolvedIds.push(created.label.id);
    }

    return resolvedIds;
  }

  private findLabelId(labels: GmailLabelRecord[], query: string): string | null {
    const normalized = String(query || '').trim().toLowerCase();
    if (!normalized) {
      return null;
    }

    const found = labels.find((label) =>
      label.id.toLowerCase() === normalized || label.name.toLowerCase() === normalized,
    );
    return found?.id || null;
  }

  async trashMessage(messageId: string): Promise<{ success: boolean; error?: string }> {
    const { client: gmail, error } = await this.getClient();
    if (!gmail) return { success: false, error };

    try {
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

  async createLabel(name: string): Promise<{ success: boolean; label?: { id: string; name: string }; error?: string }> {
    const { client: gmail, error } = await this.getClient();
    if (!gmail) return { success: false, error };

    try {
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
      if (err.message?.includes('already exists') || err.code === 409) {
        const existing = await this.getLabels();
        const found = existing.labels?.find(label => label.name.toLowerCase() === name.toLowerCase());
        if (found) return { success: true, label: found };
      }

      console.error('[GmailService] CreateLabel error:', err.message);
      return { success: false, error: err.message };
    }
  }

  async batchModifyByLabel(
    labelId: string,
    options?: { addLabels?: string[]; removeLabels?: string[]; deleteLabel?: boolean },
  ): Promise<{ success: boolean; processed: number; remaining: number; labelDeleted: boolean; error?: string }> {
    const { client: gmail, error } = await this.getClient();
    if (!gmail) return { success: false, processed: 0, remaining: 0, labelDeleted: false, error };

    try {
      const { processed, remaining } = await this.drainLabelMessages(gmail, labelId, options);
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

      return { success: true, processed, remaining, labelDeleted };
    } catch (err: any) {
      console.error('[GmailService] BatchModifyByLabel error:', err.message);
      return { success: false, processed: 0, remaining: 0, labelDeleted: false, error: err.message };
    }
  }

  async emptyAndDeleteAllLabels(): Promise<{
    success: boolean;
    labelsProcessed: number;
    labelsDeleted: number;
    totalMessagesMovedToInbox: number;
    remainingLabels: string[];
    errors: string[];
  }> {
    const { client: gmail, error } = await this.getClient();
    if (!gmail) {
      return {
        success: false,
        labelsProcessed: 0,
        labelsDeleted: 0,
        totalMessagesMovedToInbox: 0,
        remainingLabels: [],
        errors: [error || 'Google no conectado'],
      };
    }

    try {
      const labelsResponse = await gmail.users.labels.list({ userId: 'me' });
      const allLabels = labelsResponse.data.labels || [];
      const systemLabelIds = new Set([
        'INBOX', 'SPAM', 'TRASH', 'UNREAD', 'STARRED', 'IMPORTANT', 'SENT', 'DRAFT',
        'CATEGORY_PERSONAL', 'CATEGORY_SOCIAL', 'CATEGORY_PROMOTIONS', 'CATEGORY_UPDATES', 'CATEGORY_FORUMS',
        'CHAT',
      ]);
      const userLabels = allLabels.filter((label: any) => label.id && !systemLabelIds.has(label.id) && label.type === 'user');

      let labelsProcessed = 0;
      let labelsDeleted = 0;
      let totalMessagesMovedToInbox = 0;
      const errors: string[] = [];

      for (const label of userLabels) {
        if (!label.id) continue;

        try {
          const { processed, remaining } = await this.drainLabelMessages(gmail, label.id);
          totalMessagesMovedToInbox += processed;
          labelsProcessed++;

          if (remaining === 0) {
            try {
              await gmail.users.labels.delete({ userId: 'me', id: label.id });
              labelsDeleted++;
              console.log(`[GmailService] Emptied (${processed} msgs) and deleted label: ${label.name} (${label.id})`);
            } catch (delErr: any) {
              errors.push(`No se pudo eliminar "${label.name}": ${delErr.message}`);
            }
          } else {
            errors.push(`La etiqueta "${label.name}" aun tiene correos pendientes; no se elimino.`);
          }
        } catch (labelErr: any) {
          errors.push(`Error procesando "${label.name}": ${labelErr.message}`);
        }
      }

      const verifyResponse = await gmail.users.labels.list({ userId: 'me' });
      const remainingLabels = (verifyResponse.data.labels || [])
        .filter((label: any) => label.id && !systemLabelIds.has(label.id) && label.type === 'user')
        .map((label: any) => label.name || label.id || 'unknown');

      return {
        success: true,
        labelsProcessed,
        labelsDeleted,
        totalMessagesMovedToInbox,
        remainingLabels,
        errors,
      };
    } catch (err: any) {
      console.error('[GmailService] EmptyAndDeleteAllLabels error:', err.message);
      return {
        success: false,
        labelsProcessed: 0,
        labelsDeleted: 0,
        totalMessagesMovedToInbox: 0,
        remainingLabels: [],
        errors: [err.message],
      };
    }
  }

  async deleteLabel(labelId: string): Promise<{ success: boolean; error?: string }> {
    const { client: gmail, error } = await this.getClient();
    if (!gmail) return { success: false, error };

    try {
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

  async getLabels(): Promise<{ success: boolean; labels?: Array<{ id: string; name: string }>; error?: string }> {
    const { client: gmail, error } = await this.getClient();
    if (!gmail) return { success: false, error };

    try {
      const response = await gmail.users.labels.list({ userId: 'me' });
      const labels = (response.data.labels || []).map((label: any) => ({
        id: label.id || '',
        name: label.name || '',
      }));

      return { success: true, labels };
    } catch (err: any) {
      console.error('[GmailService] GetLabels error:', err.message);
      return { success: false, error: err.message };
    }
  }
}
