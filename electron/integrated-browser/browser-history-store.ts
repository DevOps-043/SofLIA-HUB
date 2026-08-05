import { app } from 'electron';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { BrowserHistoryEntry } from './types';

const HISTORY_LIMIT = 2_000;
const QUERY_LIMIT = 200;
const DEFAULT_QUERY_LIMIT = 50;

export class BrowserHistoryStore {
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(private readonly filePath = path.join(app.getPath('userData'), 'integrated-browser', 'history.jsonl')) {}

  async record(input: { url: string; title?: string; visitedAt?: string }): Promise<BrowserHistoryEntry | null> {
    const url = sanitizeHistoryUrl(input.url);
    if (!url) return null;
    const entry: BrowserHistoryEntry = {
      id: randomUUID(),
      url,
      title: sanitizeTitle(input.title),
      visitedAt: normalizeTimestamp(input.visitedAt),
    };
    await this.enqueue(async () => {
      const entries = await this.readAllUnsafe();
      const previous = entries[entries.length - 1];
      if (previous?.url === entry.url && Date.parse(entry.visitedAt) - Date.parse(previous.visitedAt) < 2_000) {
        entries[entries.length - 1] = { ...entry, id: previous.id };
      } else {
        entries.push(entry);
      }
      await this.writeAll(entries.slice(-HISTORY_LIMIT));
    });
    return entry;
  }

  async list(input: { query?: unknown; limit?: unknown } = {}): Promise<BrowserHistoryEntry[]> {
    await this.writeQueue;
    const query = typeof input.query === 'string' ? input.query.trim().toLocaleLowerCase().slice(0, 200) : '';
    const limit = normalizeLimit(input.limit);
    return (await this.readAllUnsafe())
      .filter((entry) => !query || historySearchText(entry, query).includes(query))
      .sort((left, right) => Date.parse(right.visitedAt) - Date.parse(left.visitedAt))
      .slice(0, limit);
  }

  async clear(): Promise<void> {
    await this.enqueue(() => this.writeAll([]));
  }

  private async enqueue(operation: () => Promise<void>): Promise<void> {
    const pending = this.writeQueue.then(operation);
    this.writeQueue = pending.catch(() => undefined);
    await pending;
  }

  private async readAllUnsafe(): Promise<BrowserHistoryEntry[]> {
    try {
      const content = await fs.readFile(this.filePath, 'utf8');
      const entries: BrowserHistoryEntry[] = [];
      for (const line of content.split(/\r?\n/)) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line) as Partial<BrowserHistoryEntry>;
          const url = sanitizeHistoryUrl(parsed.url);
          if (!parsed.id || !url || !parsed.visitedAt || Number.isNaN(Date.parse(parsed.visitedAt))) continue;
          entries.push({ id: String(parsed.id), url, title: sanitizeTitle(parsed.title), visitedAt: parsed.visitedAt });
        } catch { /* conserva las lineas validas */ }
      }
      return entries.slice(-HISTORY_LIMIT);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.warn('[Navegador][Historial] No se pudo leer el historial:', safeError(error));
      }
      return [];
    }
  }

  private async writeAll(entries: BrowserHistoryEntry[]): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const temporary = `${this.filePath}.tmp`;
    const content = entries.length ? `${entries.map((entry) => JSON.stringify(entry)).join('\n')}\n` : '';
    await fs.writeFile(temporary, content, 'utf8');
    await fs.rename(temporary, this.filePath);
  }
}

function historySearchText(entry: BrowserHistoryEntry, query: string): string {
  const normalizedUrl = entry.url.toLocaleLowerCase();
  const withoutProtocol = normalizedUrl.replace(/^https?:\/\//, '');
  const searchableUrl = query.includes('://')
    ? normalizedUrl
    : `${withoutProtocol}\n${withoutProtocol.replace(/^www\./, '')}`;
  return `${entry.title}\n${searchableUrl}`.toLocaleLowerCase();
}

export function sanitizeHistoryUrl(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.length > 2_048) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    url.username = '';
    url.password = '';
    return url.toString();
  } catch {
    return null;
  }
}

function sanitizeTitle(raw: unknown): string {
  return typeof raw === 'string' ? raw.replace(/[\r\n\t]+/g, ' ').trim().slice(0, 240) : '';
}

function normalizeTimestamp(raw: unknown): string {
  if (typeof raw === 'string' && !Number.isNaN(Date.parse(raw))) return new Date(raw).toISOString();
  return new Date().toISOString();
}

function normalizeLimit(raw: unknown): number {
  if (typeof raw !== 'number' || !Number.isSafeInteger(raw)) return DEFAULT_QUERY_LIMIT;
  return Math.min(QUERY_LIMIT, Math.max(1, raw));
}

function safeError(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).replace(/[\r\n\t]+/g, ' ').slice(0, 200);
}
