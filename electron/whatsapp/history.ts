import { app } from 'electron';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { normalizePhoneNumber } from './phone-utils';

export type WhatsAppConversationHistoryDirection = 'incoming' | 'outgoing' | 'system';
export type WhatsAppConversationHistoryKind =
  | 'text'
  | 'command'
  | 'media'
  | 'audio'
  | 'file'
  | 'tool'
  | 'transcription';
export type WhatsAppConversationHistorySource = 'whatsapp-service' | 'whatsapp-agent' | 'tool-loop';

export interface WhatsAppConversationHistoryMedia {
  fileName?: string;
  mimetype?: string;
  sizeBytes?: number;
}

export interface WhatsAppConversationHistoryTool {
  names: string[];
  summary: Array<Record<string, unknown>>;
}

export interface WhatsAppConversationHistoryEvent {
  id: string;
  timestamp: string;
  direction: WhatsAppConversationHistoryDirection;
  kind: WhatsAppConversationHistoryKind;
  jid: string;
  senderNumber?: string | null;
  groupJid?: string | null;
  isGroup: boolean;
  text?: string;
  media?: WhatsAppConversationHistoryMedia;
  tool?: WhatsAppConversationHistoryTool;
  source: WhatsAppConversationHistorySource;
  metadata?: Record<string, unknown>;
}

export type WhatsAppConversationHistoryInput = Omit<WhatsAppConversationHistoryEvent, 'id' | 'timestamp'> & {
  id?: string;
  timestamp?: string;
};

export interface WhatsAppConversationHistoryFilters {
  jid?: string;
  senderNumber?: string;
  query?: string;
  direction?: WhatsAppConversationHistoryDirection;
  kind?: WhatsAppConversationHistoryKind;
  since?: string | number | Date;
  until?: string | number | Date;
  limit?: number;
}

export interface WhatsAppConversationHistoryStats {
  total: number;
  incoming: number;
  outgoing: number;
  system: number;
  text: number;
  command: number;
  media: number;
  audio: number;
  file: number;
  tool: number;
  transcription: number;
  lastEventAt: string | null;
  byContact: Array<{ senderNumber: string; count: number; lastEventAt: string }>;
}

const HISTORY_FILE = 'whatsapp-conversation-history.jsonl';
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 1000;

export class WhatsAppConversationHistoryStore {
  private readonly filePath: string;

  constructor(filePath = path.join(app.getPath('userData'), HISTORY_FILE)) {
    this.filePath = filePath;
  }

  getPath(): string {
    return this.filePath;
  }

  async append(input: WhatsAppConversationHistoryInput): Promise<WhatsAppConversationHistoryEvent | null> {
    try {
      await fs.mkdir(path.dirname(this.filePath), { recursive: true });
      const event = normalizeHistoryEvent(input);
      await fs.appendFile(this.filePath, `${JSON.stringify(event)}\n`, 'utf8');
      return event;
    } catch (error) {
      console.error('[WhatsApp History] No se pudo guardar el evento:', error instanceof Error ? error.message : String(error));
      return null;
    }
  }

  async list(filters: WhatsAppConversationHistoryFilters = {}): Promise<WhatsAppConversationHistoryEvent[]> {
    const events = await this.readAll();
    const limit = normalizeLimit(filters.limit);
    const since = toTimestamp(filters.since);
    const until = toTimestamp(filters.until);
    const senderNumber = normalizePhoneNumber(filters.senderNumber || '');
    const query = normalizeQuery(filters.query);

    return events
      .filter((event) => {
        const timestamp = Date.parse(event.timestamp);
        if (filters.jid && event.jid !== filters.jid && event.groupJid !== filters.jid) return false;
        if (senderNumber && normalizePhoneNumber(event.senderNumber || '') !== senderNumber) return false;
        if (filters.direction && event.direction !== filters.direction) return false;
        if (filters.kind && event.kind !== filters.kind) return false;
        if (since !== null && timestamp < since) return false;
        if (until !== null && timestamp > until) return false;
        if (query && !matchesQuery(event, query)) return false;
        return true;
      })
      .sort((left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp))
      .slice(0, limit);
  }

  async getStats(): Promise<WhatsAppConversationHistoryStats> {
    const events = await this.readAll();
    const stats: WhatsAppConversationHistoryStats = {
      total: events.length,
      incoming: 0,
      outgoing: 0,
      system: 0,
      text: 0,
      command: 0,
      media: 0,
      audio: 0,
      file: 0,
      tool: 0,
      transcription: 0,
      lastEventAt: null,
      byContact: [],
    };
    const contacts = new Map<string, { count: number; lastEventAt: string }>();

    for (const event of events) {
      stats[event.direction] += 1;
      stats[event.kind] += 1;
      if (!stats.lastEventAt || Date.parse(event.timestamp) > Date.parse(stats.lastEventAt)) {
        stats.lastEventAt = event.timestamp;
      }
      const senderNumber = normalizePhoneNumber(event.senderNumber || directNumberFromJid(event.jid));
      if (!senderNumber) continue;
      const previous = contacts.get(senderNumber);
      if (!previous || Date.parse(event.timestamp) > Date.parse(previous.lastEventAt)) {
        contacts.set(senderNumber, { count: (previous?.count || 0) + 1, lastEventAt: event.timestamp });
      } else {
        previous.count += 1;
      }
    }

    stats.byContact = Array.from(contacts.entries())
      .map(([senderNumber, value]) => ({ senderNumber, ...value }))
      .sort((left, right) => Date.parse(right.lastEventAt) - Date.parse(left.lastEventAt))
      .slice(0, 20);
    return stats;
  }

  private async readAll(): Promise<WhatsAppConversationHistoryEvent[]> {
    try {
      const content = await fs.readFile(this.filePath, 'utf8');
      const events: WhatsAppConversationHistoryEvent[] = [];
      for (const line of content.split(/\r?\n/)) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line) as WhatsAppConversationHistoryEvent;
          if (isHistoryEvent(parsed)) events.push(parsed);
        } catch {
          // Ignora lineas corruptas para mantener el historial utilizable.
        }
      }
      return events;
    } catch (error: any) {
      if (error?.code !== 'ENOENT') {
        console.warn('[WhatsApp History] No se pudo leer el historial:', error.message || String(error));
      }
      return [];
    }
  }
}

export function directNumberFromJid(jid: string): string {
  if (!jid || jid.endsWith('@g.us')) return '';
  return normalizePhoneNumber(jid.split('@')[0] || '');
}

function normalizeHistoryEvent(input: WhatsAppConversationHistoryInput): WhatsAppConversationHistoryEvent {
  return {
    id: input.id || randomUUID(),
    timestamp: input.timestamp || new Date().toISOString(),
    direction: input.direction,
    kind: input.kind,
    jid: String(input.jid || ''),
    senderNumber: input.senderNumber ? normalizePhoneNumber(input.senderNumber) || String(input.senderNumber) : null,
    groupJid: input.groupJid || (input.isGroup ? input.jid : null),
    isGroup: Boolean(input.isGroup),
    text: typeof input.text === 'string' ? input.text : undefined,
    media: input.media ? sanitizeMedia(input.media) : undefined,
    tool: input.tool ? sanitizeTool(input.tool) : undefined,
    source: input.source,
    metadata: input.metadata ? sanitizeMetadata(input.metadata) : undefined,
  };
}

function sanitizeMedia(media: WhatsAppConversationHistoryMedia): WhatsAppConversationHistoryMedia {
  return {
    fileName: media.fileName ? String(media.fileName) : undefined,
    mimetype: media.mimetype ? String(media.mimetype) : undefined,
    sizeBytes: typeof media.sizeBytes === 'number' ? media.sizeBytes : undefined,
  };
}

function sanitizeTool(tool: WhatsAppConversationHistoryTool): WhatsAppConversationHistoryTool {
  return {
    names: Array.isArray(tool.names) ? tool.names.map(String).slice(0, 30) : [],
    summary: Array.isArray(tool.summary)
      ? tool.summary.map((item) => sanitizeMetadata(item)).slice(0, 30)
      : [],
  };
}

function sanitizeMetadata(input: Record<string, unknown>, depth = 0): Record<string, unknown> {
  if (depth > 4) return {};
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input).slice(0, 50)) {
    if (value === undefined || typeof value === 'function') continue;
    if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) {
      output[key] = value as string | number | boolean | null;
      continue;
    }
    if (Array.isArray(value)) {
      output[key] = value
        .filter((item) => item === null || ['string', 'number', 'boolean'].includes(typeof item))
        .slice(0, 50);
      continue;
    }
    if (typeof value === 'object') output[key] = sanitizeMetadata(value as Record<string, unknown>, depth + 1);
  }
  return output;
}

function normalizeLimit(limit: number | undefined): number {
  if (!Number.isFinite(limit || 0)) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(1, Math.floor(limit || DEFAULT_LIMIT)));
}

function toTimestamp(value: string | number | Date | undefined): number | null {
  if (value === undefined || value === null || value === '') return null;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function normalizeQuery(query: string | undefined): string {
  return String(query || '').trim().toLowerCase();
}

function matchesQuery(event: WhatsAppConversationHistoryEvent, query: string): boolean {
  const haystack = [
    event.text,
    event.media?.fileName,
    event.media?.mimetype,
    event.tool?.names.join(' '),
    event.tool?.summary.map((item) => JSON.stringify(item)).join(' '),
  ].filter(Boolean).join('\n').toLowerCase();
  return haystack.includes(query);
}

function isHistoryEvent(value: WhatsAppConversationHistoryEvent): boolean {
  return Boolean(value?.id && value.timestamp && value.direction && value.kind && value.jid && value.source);
}
