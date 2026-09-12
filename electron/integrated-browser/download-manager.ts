import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { app, shell, type DownloadItem, type Session, type WebContents } from 'electron';
import type { BrowserDownloadRecord, BrowserDownloadState } from './platform-types';

type TrackedDownload = {
  record: BrowserDownloadRecord;
  item: DownloadItem | null;
  sourceUrl: string;
  savePath: string;
};

const MAX_DOWNLOAD_RECORDS = 200;
const MAX_ACTIVE_DOWNLOADS = 20;

export class BrowserDownloadManager {
  private readonly sessions = new WeakMap<Session, { generation: number }>();
  private generation = 0;
  private readonly downloads = new Map<string, TrackedDownload>();

  constructor(
    private readonly onChanged: (records: BrowserDownloadRecord[]) => void = () => undefined,
    private readonly downloadRoot = app.getPath('downloads'),
    private readonly assertSourceAllowed: (sourceUrl: string) => void = () => undefined,
  ) {}

  attach(session: Session): void {
    const existing = this.sessions.get(session);
    if (existing) { existing.generation = this.generation; return; }
    const registration = { generation: this.generation };
    this.sessions.set(session, registration);
    session.on('will-download', (_event, item) => {
      if (registration.generation !== this.generation) { item.cancel(); return; }
      this.accept(item);
    });
  }

  resetForProfileChange(): void {
    this.generation += 1;
    const active = [...this.downloads.values()];
    this.downloads.clear();
    for (const tracked of active) tracked.item?.cancel();
    this.changed();
  }

  list(): BrowserDownloadRecord[] {
    return Array.from(this.downloads.values())
      .map(({ record }) => ({ ...record }))
      .sort((left, right) => right.startedAt.localeCompare(left.startedAt));
  }

  cancel(id: string): BrowserDownloadRecord {
    const tracked = this.require(id);
    if (tracked.record.state === 'completed' || tracked.record.state === 'cancelled') return { ...tracked.record };
    tracked.record = { ...tracked.record, state: 'cancelled', canResume: false, completedAt: new Date().toISOString() };
    tracked.item?.cancel();
    tracked.item = null;
    this.changed();
    return { ...tracked.record };
  }

  resume(id: string): BrowserDownloadRecord {
    const tracked = this.require(id);
    if (!tracked.item || !tracked.item.canResume()) throw new Error('La descarga ya no puede reanudarse.');
    this.assertSourceAllowed(tracked.sourceUrl);
    tracked.item.resume();
    tracked.record = { ...tracked.record, state: 'progressing', canResume: false, error: null };
    this.changed();
    return { ...tracked.record };
  }

  retry(id: string, contents: WebContents, assertSourceAllowed: (sourceUrl: string) => void = () => undefined): BrowserDownloadRecord {
    const tracked = this.require(id);
    if (!isHttpUrl(tracked.sourceUrl)) throw new Error('La descarga no conserva un origen válido para reintentar.');
    this.assertSourceAllowed(tracked.sourceUrl);
    assertSourceAllowed(tracked.sourceUrl);
    contents.downloadURL(tracked.sourceUrl);
    return { ...tracked.record };
  }

  async open(id: string): Promise<void> {
    const tracked = this.requireCompleted(id);
    const error = await shell.openPath(tracked.savePath);
    if (error) throw new Error('El sistema no pudo abrir el archivo descargado.');
  }

  reveal(id: string): void {
    const tracked = this.requireCompleted(id);
    shell.showItemInFolder(tracked.savePath);
  }

  private accept(item: DownloadItem): void {
    const sourceUrl = item.getURL();
    const id = randomUUID();
    const filename = sanitizeDownloadFilename(item.getFilename());
    const startedAt = new Date().toISOString();

    let blockedReason = !isHttpUrl(sourceUrl) ? 'El protocolo de la descarga no está permitido.'
      : [...this.downloads.values()].filter((download) => download.item).length >= MAX_ACTIVE_DOWNLOADS
        ? 'Hay 20 descargas activas. Cancela o termina una antes de iniciar otra.' : null;
    let savePath = '';
    if (!blockedReason) {
      try {
        this.assertSourceAllowed(sourceUrl);
      } catch {
        blockedReason = 'La descarga fue bloqueada por la política de protección local.';
      }
    }
    if (!blockedReason) {
      try {
        fs.mkdirSync(this.downloadRoot, { recursive: true });
        const reserved = new Set([...this.downloads.values()].map((download) => canonicalPath(download.savePath)));
        savePath = availablePath(this.downloadRoot, filename, reserved);
        item.setSavePath(savePath);
      } catch {
        blockedReason = 'No se pudo preparar un destino seguro en Descargas.';
      }
    }
    if (blockedReason) {
      item.cancel();
      this.downloads.set(id, {
        item: null,
        sourceUrl: '',
        savePath: '',
        record: {
          id,
          filename,
          origin: safeOrigin(sourceUrl),
          receivedBytes: 0,
          totalBytes: Math.max(0, item.getTotalBytes()),
          progress: 0,
          state: 'blocked',
          canResume: false,
          startedAt,
          completedAt: startedAt,
          error: blockedReason,
        },
      });
      this.trim();
      this.changed();
      return;
    }

    const tracked: TrackedDownload = {
      item,
      sourceUrl,
      savePath,
      record: {
        id,
        filename: path.basename(savePath),
        origin: safeOrigin(sourceUrl),
        receivedBytes: Math.max(0, item.getReceivedBytes()),
        totalBytes: Math.max(0, item.getTotalBytes()),
        progress: progressFor(item.getReceivedBytes(), item.getTotalBytes()),
        state: 'progressing',
        canResume: false,
        startedAt,
        completedAt: null,
        error: null,
      },
    };
    this.downloads.set(id, tracked);
    this.trim();
    this.changed();

    item.on('updated', (_event, state) => {
      if (!this.downloads.has(id) || tracked.record.state === 'cancelled') return;
      tracked.record = {
        ...tracked.record,
        receivedBytes: Math.max(0, item.getReceivedBytes()),
        totalBytes: Math.max(0, item.getTotalBytes()),
        progress: progressFor(item.getReceivedBytes(), item.getTotalBytes()),
        state: normalizeDownloadState(state),
        canResume: item.canResume(),
        error: state === 'interrupted' ? 'La descarga fue interrumpida.' : null,
      };
      this.changed();
    });
    item.once('done', (_event, state) => {
      if (!this.downloads.has(id) || tracked.record.state === 'cancelled') return;
      tracked.item = state === 'interrupted' && item.canResume() ? item : null;
      tracked.record = {
        ...tracked.record,
        receivedBytes: Math.max(0, item.getReceivedBytes()),
        totalBytes: Math.max(0, item.getTotalBytes()),
        progress: state === 'completed' ? 1 : progressFor(item.getReceivedBytes(), item.getTotalBytes()),
        state: normalizeDownloadState(state),
        canResume: state === 'interrupted' && item.canResume(),
        completedAt: state === 'completed' || state === 'cancelled' ? new Date().toISOString() : null,
        error: state === 'interrupted' ? 'La descarga fue interrumpida.' : null,
      };
      this.changed();
    });
  }

  private require(id: string): TrackedDownload {
    const tracked = this.downloads.get(id);
    if (!tracked) throw new Error('La descarga indicada no existe.');
    return tracked;
  }

  private requireCompleted(id: string): TrackedDownload {
    const tracked = this.require(id);
    if (tracked.record.state !== 'completed' || !tracked.savePath) throw new Error('La descarga todavía no está disponible.');
    return tracked;
  }

  private trim(): void {
    while (this.downloads.size > MAX_DOWNLOAD_RECORDS) {
      // Una descarga viva nunca debe desaparecer de los controles de cancelación.
      const oldest = [...this.downloads.entries()].find(([, download]) => !download.item)?.[0];
      if (!oldest) break;
      this.downloads.delete(oldest);
    }
  }

  private changed(): void {
    this.onChanged(this.list());
  }
}

export function sanitizeDownloadFilename(raw: string): string {
  const basename = path.basename(raw || 'descarga');
  const cleaned = stripControlCharacters(basename.replace(/[<>:"/\\|?*]/g, '_')).replace(/[. ]+$/g, '').slice(0, 180);
  if (!cleaned || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i.test(cleaned)) return `descarga-${Date.now()}`;
  return cleaned;
}

function stripControlCharacters(value: string): string {
  return Array.from(value, (character) => character.charCodeAt(0) <= 31 ? '_' : character).join('');
}

function canonicalPath(value: string): string {
  return process.platform === 'win32' ? value.toLowerCase() : value;
}

function availablePath(root: string, filename: string, reserved: Set<string>): string {
  const extension = path.extname(filename);
  const base = path.basename(filename, extension);
  let candidate = path.join(root, filename);
  for (let suffix = 1; fs.existsSync(candidate) || reserved.has(canonicalPath(candidate)); suffix += 1) {
    if (suffix > 10_000) throw new Error('No se encontró un nombre disponible para la descarga.');
    candidate = path.join(root, `${base} (${suffix})${extension}`);
  }
  return candidate;
}

function isHttpUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

function safeOrigin(raw: string): string {
  try { return new URL(raw).origin; } catch { return 'origen desconocido'; }
}

function progressFor(received: number, total: number): number | null {
  if (!Number.isFinite(total) || total <= 0) return null;
  return Math.max(0, Math.min(1, received / total));
}

function normalizeDownloadState(state: string): BrowserDownloadState {
  if (state === 'progressing' || state === 'completed' || state === 'cancelled' || state === 'interrupted') return state;
  return 'interrupted';
}
