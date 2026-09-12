import fs from 'node:fs/promises';
import path from 'node:path';
import { dialog, type BrowserWindow } from 'electron';
import { BrowserHistoryStore, sanitizeHistoryUrl, type BrowserHistoryImportEntry } from './browser-history-store';

export const MAX_HISTORY_IMPORT_BYTES = 5 * 1024 * 1024;
export const MAX_HISTORY_IMPORT_ENTRIES = 50_000;

export class BrowserHistoryImportRejected extends Error {
  constructor(message: string) { super(message); this.name = 'BrowserHistoryImportRejected'; }
}

export interface HistoryImportContext {
  scopeId: string;
  generation: number;
  changing: boolean;
  parent: BrowserWindow | null;
}

export interface BrowserHistoryImportResult {
  cancelled: boolean;
  imported: number;
  skipped: number;
  duplicates: number;
  invalid: number;
}

export interface BrowserHistoryImportSummary {
  total: number;
  validCount: number;
  duplicateCount: number;
  invalidCount: number;
}

const cancelledResult = (): BrowserHistoryImportResult => ({
  cancelled: true, imported: 0, skipped: 0, duplicates: 0, invalid: 0,
});

/** Selección, preflight y confirmación nativas; nunca devuelve URLs al renderer. */
export class BrowserHistoryImporter {
  private busy = false;

  constructor(
    private readonly store: BrowserHistoryStore,
    private readonly getContext: () => HistoryImportContext,
  ) {}

  async importFromDialog(): Promise<BrowserHistoryImportResult> {
    if (this.busy) throw new BrowserHistoryImportRejected('Ya hay una importación de historial en revisión.');
    const initial = { ...this.getContext() };
    const parent = initial.parent;
    const assertCurrent = () => {
      const current = this.getContext();
      if (!parent || parent.isDestroyed() || current.parent !== parent || current.changing
        || current.scopeId !== initial.scopeId || current.generation !== initial.generation) {
        throw new BrowserHistoryImportRejected('El perfil o la ventana cambió durante la importación. Vuelve a intentarlo.');
      }
    };
    assertCurrent();
    if (!parent) throw new BrowserHistoryImportRejected('El navegador no está iniciado.');
    this.busy = true;
    try {
      const selection = await dialog.showOpenDialog(parent, {
        title: 'Seleccionar historial para revisar', properties: ['openFile'],
        filters: [{ name: 'Historial JSON', extensions: ['json', 'jsonl'] }],
      });
      assertCurrent();
      if (selection.canceled || !selection.filePaths[0]) return cancelledResult();
      const raw = await readHistoryImportFile(selection.filePaths[0]);
      assertCurrent();
      const prepared = parseHistoryImport(raw, path.extname(selection.filePaths[0]).toLowerCase());
      assertCurrent();
      const counts = `${prepared.summary.validCount} válidos; ${prepared.summary.duplicateCount} duplicados; ${prepared.summary.invalidCount} inválidos.`;
      if (!prepared.summary.validCount) {
        await dialog.showMessageBox(parent, {
          type: 'info', title: 'Revisión de historial', message: 'No hay visitas válidas para importar.',
          detail: counts, buttons: ['Cerrar'], defaultId: 0, cancelId: 0, noLink: true,
        });
        assertCurrent();
        return { cancelled: false, imported: 0, skipped: prepared.summary.total, duplicates: prepared.summary.duplicateCount, invalid: prepared.summary.invalidCount };
      }
      const decision = await dialog.showMessageBox(parent, {
        type: 'question', title: 'Revisar importación de historial',
        message: '¿Importar las visitas revisadas?',
        detail: `${counts}\n\nSe incorporarán sólo URLs HTTP(S) y fechas válidas. Las visitas repetidas, fuera de la retención o ya existentes se omiten. No se importan cookies, marcadores ni contraseñas.`,
        buttons: ['Importar historial', 'Cancelar'], defaultId: 1, cancelId: 1, noLink: true,
      });
      assertCurrent();
      if (decision.response !== 0) return cancelledResult();
      const result = await this.store.importEntries(prepared.entries, assertCurrent);
      assertCurrent();
      return { cancelled: false, imported: result.imported, skipped: result.skipped, duplicates: prepared.summary.duplicateCount, invalid: prepared.summary.invalidCount };
    } catch (error) {
      if (error instanceof BrowserHistoryImportRejected) throw error;
      throw new BrowserHistoryImportRejected('No se pudo completar la importación del historial. Selecciona un JSON de hasta 5 MB y vuelve a intentarlo.');
    } finally { this.busy = false; }
  }
}

/** Lee con cuota desde el mismo descriptor para no aceptar archivos que crecen durante la lectura. */
export async function readHistoryImportFile(filename: string): Promise<string> {
  if (!['.json', '.jsonl'].includes(path.extname(filename).toLowerCase())) throw new BrowserHistoryImportRejected('Selecciona un archivo de historial JSON o JSONL.');
  try {
    const handle = await fs.open(filename, 'r');
    try {
      const stat = await handle.stat();
      if (!stat.isFile() || stat.size > MAX_HISTORY_IMPORT_BYTES) throw new Error('over-quota');
      const buffer = Buffer.alloc(MAX_HISTORY_IMPORT_BYTES + 1);
      let length = 0;
      while (length < buffer.length) {
        const result = await handle.read(buffer, length, buffer.length - length, null);
        if (!result.bytesRead) break;
        length += result.bytesRead;
      }
      if (length > MAX_HISTORY_IMPORT_BYTES) throw new Error('over-quota');
      return buffer.subarray(0, length).toString('utf8');
    } finally { await handle.close(); }
  } catch {
    throw new BrowserHistoryImportRejected('No se pudo leer el historial. Debe ser un archivo JSON o JSONL de hasta 5 MB.');
  }
}

export function parseHistoryImport(raw: string, extension = '.json'): { entries: BrowserHistoryImportEntry[]; summary: BrowserHistoryImportSummary } {
  if (typeof raw !== 'string' || Buffer.byteLength(raw, 'utf8') > MAX_HISTORY_IMPORT_BYTES) throw new BrowserHistoryImportRejected('El archivo de historial supera el límite permitido.');
  const source = extension === '.jsonl' ? parseJsonLines(raw) : parseJsonDocument(raw);
  if (source.length > MAX_HISTORY_IMPORT_ENTRIES) throw new BrowserHistoryImportRejected('El archivo de historial supera el máximo de 50 000 visitas.');
  const entries: BrowserHistoryImportEntry[] = [];
  const seen = new Set<string>();
  let invalidCount = 0;
  let duplicateCount = 0;
  for (const value of source) {
    const entry = normalizeHistoryEntry(value);
    if (!entry) { invalidCount++; continue; }
    const key = `${entry.url}\u0000${entry.visitedAt}`;
    if (seen.has(key)) { duplicateCount++; continue; }
    seen.add(key); entries.push(entry);
  }
  return { entries, summary: { total: source.length, validCount: entries.length, duplicateCount, invalidCount } };
}

function parseJsonDocument(raw: string): unknown[] {
  try {
    const value: unknown = JSON.parse(raw);
    if (Array.isArray(value)) return value;
    if (value && typeof value === 'object' && Array.isArray((value as { history?: unknown }).history)) return (value as { history: unknown[] }).history;
  } catch { /* JSONL fallback below keeps corrupt lines isolated. */ }
  return parseJsonLines(raw);
}

function parseJsonLines(raw: string): unknown[] {
  const values: unknown[] = [];
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try { values.push(JSON.parse(line)); } catch { values.push(null); }
    if (values.length > MAX_HISTORY_IMPORT_ENTRIES) throw new BrowserHistoryImportRejected('El archivo de historial supera el máximo de 50 000 visitas.');
  }
  return values;
}

function normalizeHistoryEntry(value: unknown): BrowserHistoryImportEntry | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const url = sanitizeHistoryUrl(input.url);
  if (!url) return null;
  const visitedAt = normalizeVisitedAt(input.visitedAt ?? input.lastVisitTime ?? input.last_visit_time);
  if (!visitedAt) return null;
  return { url, title: typeof input.title === 'string' ? input.title.slice(0, 500) : '', visitedAt };
}

function normalizeVisitedAt(value: unknown): string | null {
  let milliseconds: number;
  if (typeof value === 'number' && Number.isFinite(value)) milliseconds = value > 10_000_000_000_000 ? (value / 1_000) - 11_644_473_600_000 : value;
  else if (typeof value === 'string' && value.trim()) {
    const numeric = Number(value);
    milliseconds = Number.isFinite(numeric) && numeric > 10_000_000_000_000 ? (numeric / 1_000) - 11_644_473_600_000 : Date.parse(value);
  } else return null;
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) return null;
  const date = new Date(milliseconds);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
