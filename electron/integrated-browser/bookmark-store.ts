import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { browserProfilePath, resolveStoreLocation } from './profile-scope';
import type { BrowserBookmark } from './platform-types';

type BookmarkFile = { version: 1; bookmarks: BrowserBookmark[] };
export const MAX_BOOKMARKS = 5_000;
export const MAX_BOOKMARK_IMPORT_BYTES = 5 * 1024 * 1024;
export const BOOKMARK_IMPORT_REVIEW_TTL_MS = 5 * 60_000;
const MAX_BOOKMARK_STORE_BYTES = 32 * 1024 * 1024;
const FILE_CHAINS = new Map<string, Promise<unknown>>();

/** Sólo mensajes constantes de este contrato pueden llegar al renderer. */
export class BookmarkImportRejected extends Error {}
class UnsupportedBookmarkVersion extends BookmarkImportRejected {}

export interface BookmarkImportSummary {
  total: number;
  newCount: number;
  duplicateCount: number;
  conflictCount: number;
  invalidCount: number;
}

export interface PreparedBookmarkImport {
  summary: Readonly<BookmarkImportSummary>;
  commit: (mode: 'skip' | 'update', assertCurrent?: () => void) => Promise<{ imported: number; updated: number; skipped: number }>;
}

export class BrowserBookmarkStore {
  private writeQueue = Promise.resolve();
  constructor(private readonly location: string | (() => string) = () => browserProfilePath('bookmarks.json')) {}

  /** Recuperación explícita: nunca convierte un fallo de lectura en biblioteca vacía. */
  async prepareRecovery(): Promise<{ count: number; commit: (guard: () => void) => Promise<number> }> {
    const destination = this.filePath;
    let original: string | null = null;
    let backup = '';
    let count = 0;
    await this.enqueue(async () => {
      original = await readBookmarkBytes(destination);
      if (original !== null) {
        let valid = false;
        try { parseBookmarkFile(original); valid = true; }
        catch (error) { if (error instanceof UnsupportedBookmarkVersion) throw error; }
        if (valid) throw new BookmarkImportRejected('La biblioteca actual es válida. No se reemplazará por un respaldo anterior.');
      }
      const candidate = await readBookmarkBytes(`${destination}.bak`);
      if (candidate === null) throw new BookmarkImportRejected('No existe un respaldo de marcadores para recuperar.');
      count = parseBookmarkFile(candidate).bookmarks.length;
      backup = candidate;
    }, destination);
    const expiresAt = Date.now() + BOOKMARK_IMPORT_REVIEW_TTL_MS;
    let consumed = false;
    return { count, commit: async (guard) => {
      if (consumed) throw new BookmarkImportRejected('Esta revisión de recuperación ya se utilizó.');
      consumed = true;
      const assertCurrent = () => {
        guard();
        if (this.filePath !== destination) throw new BookmarkImportRejected('El perfil cambió durante la recuperación.');
        if (Date.now() >= expiresAt) throw new BookmarkImportRejected('La revisión de recuperación venció. Vuelve a intentarlo.');
      };
      await this.enqueue(async () => {
        assertCurrent();
        if (await readBookmarkBytes(destination) !== original || await readBookmarkBytes(`${destination}.bak`) !== backup) {
          throw new BookmarkImportRejected('Los archivos de marcadores cambiaron. Revisa la recuperación de nuevo.');
        }
        assertCurrent();
        const temporary = `${destination}.${randomUUID()}.tmp`;
        try {
          await writeBookmarkBytes(temporary, backup);
          assertCurrent();
          // Conservar el principal dañado sin rotar ni consumir el respaldo.
          if (original !== null) {
            const archive = `${destination}.corrupt-${createHash('sha256').update(original).digest('hex')}`;
            try { await writeBookmarkBytes(archive, original); }
            catch (error) {
              if ((error as NodeJS.ErrnoException).code !== 'EEXIST' || await readBookmarkBytes(archive) !== original) throw error;
            }
          }
          assertCurrent();
          await fs.rename(temporary, destination);
        } finally { await fs.unlink(temporary).catch(() => undefined); }
      }, destination);
      return count;
    } };
  }

  /** Proyección consumible antes del commit remoto: sin fechas inventadas ni URLs ambiguas. */
  async prepareSync(raw: unknown) {
    const { normalizeBrowserSyncInput } = await import('./sync-crypto');
    const normalized = normalizeBrowserSyncInput({ category: 'bookmarks', payload: raw }).payload;
    if (!Array.isArray(normalized) || normalized.length > MAX_BOOKMARKS) throw new Error('Los marcadores sincronizados exceden la cuota.');
    const rows = [...normalized].sort((a, b) => Number(a.position ?? 0) - Number(b.position ?? 0) || String(a.id).localeCompare(String(b.id), 'en'));
    const result = rows.map((row, position) => {
      if (typeof row.createdAt !== 'string' || !Number.isFinite(Date.parse(row.createdAt)) || typeof row.updatedAt !== 'string' || !Number.isFinite(Date.parse(row.updatedAt))) throw new Error('El marcador remoto necesita fechas válidas.');
      const valid = validateBookmark({ ...row, title: typeof row.title === 'string' ? row.title : '', position } as Partial<BrowserBookmark> & { url: string; title: string });
      return { ...valid, id: String(row.id), tags: [...valid.tags].sort(), position, createdAt: row.createdAt, updatedAt: row.updatedAt };
    });
    if (new Set(result.map((row) => row.url)).size !== result.length) throw new Error('Hay marcadores cuya URL es idéntica al retirar parámetros privados. No se sincronizaron.');
    return normalizeBrowserSyncInput({ category: 'bookmarks', payload: result }).payload;
  }

  async applySync(expected: unknown, next: unknown, guard: () => void): Promise<boolean> {
    const destination = this.filePath;
    const { sameSyncPayload } = await import('./sync-local-adapter');
    const wanted = await this.prepareSync(next);
    if (!Array.isArray(wanted) || wanted.length > MAX_BOOKMARKS) throw new Error('Los marcadores sincronizados exceden la cuota.');
    let applied = false;
    await this.enqueue(async () => {
      guard();
      const file = await this.read(destination); guard();
      const actual = await this.prepareSync(file.bookmarks);
      if (!sameSyncPayload(actual, expected)) return;
      const bookmarks = wanted.map((row, position) => {
        const valid = validateBookmark(row as unknown as Partial<BrowserBookmark> & { url: string; title: string });
        const local = file.bookmarks.find((entry) => entry.id === row.id);
        const sameUrl = local && new URL(local.url).origin + new URL(local.url).pathname === new URL(valid.url).origin + new URL(valid.url).pathname;
        return { ...valid, id: String(row.id), url: sameUrl ? local.url : valid.url, position,
          createdAt: String(row.createdAt), updatedAt: String(row.updatedAt) };
      });
      if (new Set(bookmarks.map((row) => row.url)).size !== bookmarks.length) throw new Error('La combinación contiene URLs duplicadas.');
      await this.write({ version: 1, bookmarks }, destination, guard); applied = true;
    }, destination);
    return applied;
  }

  /** Barrera de ciclo de vida: no permite purgar el perfil mientras haya una escritura pendiente. */
  async flush(): Promise<void> {
    const destination = this.filePath;
    await this.writeQueue;
    await FILE_CHAINS.get(destination);
  }

  async list(query = ''): Promise<BrowserBookmark[]> {
    const destination = this.filePath;
    await this.writeQueue;
    const normalized = query.trim().toLocaleLowerCase('es').slice(0, 200);
    return (await this.read(destination)).bookmarks
      .filter((bookmark) => !normalized || `${bookmark.title} ${bookmark.url} ${bookmark.folderId ?? ''} ${bookmark.tags.join(' ')}`.toLocaleLowerCase('es').includes(normalized))
      .sort((left, right) => left.position - right.position)
      .map((bookmark) => ({ ...bookmark, tags: [...bookmark.tags] }));
  }

  async save(raw: Partial<BrowserBookmark> & { url: string; title: string }): Promise<BrowserBookmark> {
    const destination = this.filePath;
    const input = validateBookmark(raw);
    let saved!: BrowserBookmark;
    await this.enqueue(async () => {
      const file = await this.read(destination);
      const duplicate = file.bookmarks.find((bookmark) => bookmark.url === input.url);
      const current = file.bookmarks.find((bookmark) => bookmark.id === input.id) ?? duplicate;
      if (!current && file.bookmarks.length >= MAX_BOOKMARKS) throw new Error('Se alcanzó el límite de marcadores.');
      const now = new Date().toISOString();
      saved = {
        id: current?.id ?? randomUUID(),
        url: input.url,
        title: input.title,
        folderId: input.folderId,
        tags: input.tags,
        position: current?.position ?? file.bookmarks.length,
        createdAt: current?.createdAt ?? now,
        updatedAt: now,
      };
      file.bookmarks = file.bookmarks.filter((bookmark) => bookmark.id !== saved.id && bookmark.url !== saved.url);
      file.bookmarks.sort((left, right) => left.position - right.position);
      const target = Math.min(input.position ?? saved.position, file.bookmarks.length);
      file.bookmarks.splice(target, 0, saved);
      file.bookmarks.forEach((bookmark, position) => { bookmark.position = position; });
      await this.write(file, destination);
    });
    return { ...saved, tags: [...saved.tags] };
  }

  async remove(id: string): Promise<boolean> {
    const destination = this.filePath;
    if (typeof id !== 'string' || !id || id.length > 100) throw new Error('El marcador es inválido.');
    let removed = false;
    await this.enqueue(async () => {
      const file = await this.read(destination);
      const next = file.bookmarks.filter((bookmark) => bookmark.id !== id);
      removed = next.length !== file.bookmarks.length;
      if (removed) await this.write({ version: 1, bookmarks: next.sort((a, b) => a.position - b.position).map((bookmark, position) => ({ ...bookmark, position })) }, destination);
    });
    return removed;
  }

  async migrateLegacy(entries: unknown): Promise<{ imported: number; skipped: number }> {
    if (!Array.isArray(entries) || entries.length > 100) throw new Error('La migración de marcadores es inválida.');
    return this.importEntries(entries);
  }

  async importHtml(html: string): Promise<{ imported: number; skipped: number }> {
    if (typeof html !== 'string' || Buffer.byteLength(html, 'utf8') > MAX_BOOKMARK_IMPORT_BYTES) {
      throw new Error('El archivo de marcadores supera el límite de 5 MB.');
    }
    const entries = parseBookmarkHtml(html);
    return this.importEntries(entries);
  }

  /** Revisión main-only: la función de commit nunca se expone por IPC. */
  async prepareImportHtml(html: string): Promise<PreparedBookmarkImport> {
    if (typeof html !== 'string' || Buffer.byteLength(html, 'utf8') > MAX_BOOKMARK_IMPORT_BYTES) {
      throw new BookmarkImportRejected('El archivo de marcadores supera el límite de 5 MB.');
    }
    const destination = this.filePath;
    const entries = parseBookmarkHtml(html);
    const summary: BookmarkImportSummary = { total: entries.length, newCount: 0, duplicateCount: 0, conflictCount: 0, invalidCount: 0 };
    const candidates: ReturnType<typeof validateBookmark>[] = [];
    const seen = new Set<string>();
    for (const entry of entries) {
      try {
        const candidate = validateBookmark(entry);
        if (seen.has(candidate.url)) { summary.duplicateCount++; continue; }
        seen.add(candidate.url);
        candidates.push(candidate);
      } catch { summary.invalidCount++; }
    }
    let baseline = '';
    await this.enqueue(async () => {
      const file = await this.read(destination);
      baseline = bookmarkRevision(file);
      const existing = new Map(file.bookmarks.map((bookmark) => [bookmark.url, bookmark]));
      for (const candidate of candidates) {
        const current = existing.get(candidate.url);
        if (!current) summary.newCount++;
        else if (sameBookmarkMetadata(current, candidate)) summary.duplicateCount++;
        else summary.conflictCount++;
      }
      if (file.bookmarks.length + summary.newCount > MAX_BOOKMARKS) throw new BookmarkImportRejected('La importación supera el límite de marcadores.');
    }, destination);
    const expiresAt = Date.now() + BOOKMARK_IMPORT_REVIEW_TTL_MS;
    let consumed = false;
    return {
      summary: Object.freeze({ ...summary }),
      commit: async (mode, assertCurrent = () => undefined) => {
        if (mode !== 'skip' && mode !== 'update') throw new BookmarkImportRejected('La resolución de conflictos no es válida.');
        if (consumed) throw new BookmarkImportRejected('La revisión de importación ya se utilizó.');
        consumed = true;
        const validateContext = () => {
          assertCurrent();
          if (this.filePath !== destination) throw new BookmarkImportRejected('El perfil cambió durante la importación.');
          if (Date.now() >= expiresAt) throw new BookmarkImportRejected('La revisión de importación venció. Vuelve a seleccionar el archivo.');
        };
        let imported = 0;
        let updated = 0;
        await this.enqueue(async () => {
          validateContext();
          const file = await this.read(destination);
          validateContext();
          if (bookmarkRevision(file) !== baseline) throw new BookmarkImportRejected('Los marcadores cambiaron. Revisa la importación de nuevo.');
          const existing = new Map(file.bookmarks.map((bookmark) => [bookmark.url, bookmark]));
          const now = new Date().toISOString();
          for (const candidate of candidates) {
            const current = existing.get(candidate.url);
            if (!current) {
              file.bookmarks.push({ ...candidate, id: randomUUID(), position: file.bookmarks.length, createdAt: now, updatedAt: now });
              imported++;
            } else if (mode === 'update' && !sameBookmarkMetadata(current, candidate)) {
              Object.assign(current, { title: candidate.title, folderId: candidate.folderId, tags: [...candidate.tags], updatedAt: now });
              updated++;
            }
          }
          if (imported || updated) await this.write(file, destination, validateContext);
        }, destination);
        return { imported, updated, skipped: summary.total - imported - updated };
      },
    };
  }

  private async importEntries(entries: unknown[]): Promise<{ imported: number; skipped: number }> {
    const destination = this.filePath;
    let imported = 0;
    let skipped = 0;
    const candidates: ReturnType<typeof validateBookmark>[] = [];
    for (const entry of entries) {
      try { candidates.push(validateBookmark(entry as Parameters<typeof validateBookmark>[0])); }
      catch { skipped += 1; }
    }
    // Sólo las entradas inválidas se omiten. Un error de disco conserva la
    // fuente legacy y se devuelve al caller; nunca se informa éxito parcial.
    await this.enqueue(async () => {
      const file = await this.read(destination);
      const existing = new Set(file.bookmarks.map((bookmark) => bookmark.url));
      for (const entry of candidates) {
        if (existing.has(entry.url)) { skipped += 1; continue; }
        if (file.bookmarks.length >= MAX_BOOKMARKS) throw new Error('La importación supera el límite de marcadores.');
        const now = new Date().toISOString();
        file.bookmarks.push({ ...entry, id: randomUUID(), position: file.bookmarks.length, createdAt: now, updatedAt: now });
        existing.add(entry.url);
        imported += 1;
      }
      if (imported) await this.write(file, destination);
    });
    return { imported, skipped };
  }

  async exportHtml(): Promise<string> {
    const bookmarks = await this.list();
    const lines = [
      '<!DOCTYPE NETSCAPE-Bookmark-file-1>',
      '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
      '<TITLE>Marcadores de SofLIA</TITLE>',
      '<H1>Marcadores de SofLIA</H1>',
      '<DL><p>',
    ];
    const folders: string[] = [];
    for (const bookmark of bookmarks) {
      const wanted = bookmark.folderId?.split('/').filter(Boolean) ?? [];
      let common = 0;
      while (common < folders.length && common < wanted.length && folders[common] === wanted[common]) common += 1;
      while (folders.length > common) { lines.push('  </DL><p>'); folders.pop(); }
      for (const folder of wanted.slice(common)) {
        lines.push(`  <DT><H3>${escapeHtml(folder)}</H3>`, '  <DL><p>');
        folders.push(folder);
      }
      const created = Math.floor(Date.parse(bookmark.createdAt) / 1_000);
      const tags = bookmark.tags.length ? ` TAGS="${escapeHtml(bookmark.tags.join(','))}"` : '';
      lines.push(`  <DT><A HREF="${escapeHtml(bookmark.url)}" ADD_DATE="${Number.isFinite(created) ? created : 0}"${tags}>${escapeHtml(bookmark.title)}</A>`);
    }
    while (folders.length) { lines.push('  </DL><p>'); folders.pop(); }
    lines.push('</DL><p>', '');
    return lines.join('\n');
  }

  private async enqueue(operation: () => Promise<void>, destination = this.filePath) {
    // También serializar instancias del mismo archivo: no aprobar contra una
    // huella antigua mientras otro consumidor está escribiendo esa biblioteca.
    const previous = FILE_CHAINS.get(destination) ?? Promise.resolve();
    const pending = Promise.all([this.writeQueue, previous.catch(() => undefined)]).then(operation);
    FILE_CHAINS.set(destination, pending);
    this.writeQueue = pending.catch(() => undefined);
    void pending.finally(() => { if (FILE_CHAINS.get(destination) === pending) FILE_CHAINS.delete(destination); }).catch(() => undefined);
    await pending;
  }

  private get filePath() { return path.resolve(resolveStoreLocation(this.location)); }

  private async read(destination: string): Promise<BookmarkFile> {
    try {
      const raw = await readBookmarkBytes(destination);
      if (raw === null) {
        if (await readBookmarkBytes(`${destination}.bak`) !== null) throw new BookmarkImportRejected('Falta el archivo de marcadores. Revisa la recuperación del respaldo.');
        return { version: 1, bookmarks: [] };
      }
      return parseBookmarkFile(raw);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { version: 1, bookmarks: [] };
      const wrapped = new BookmarkImportRejected('El archivo de marcadores está dañado o no se puede leer.');
      Object.defineProperty(wrapped, 'cause', { value: error });
      throw wrapped;
    }
  }

  private async write(file: BookmarkFile, destination: string, assertCurrent: () => void = () => undefined): Promise<void> {
    const serialized = JSON.stringify(file, null, 2);
    if (Buffer.byteLength(serialized, 'utf8') > MAX_BOOKMARK_STORE_BYTES) throw new BookmarkImportRejected('La biblioteca de marcadores excede la cuota permitida.');
    const temporary = `${destination}.${randomUUID()}.tmp`;
    const backup = `${destination}.bak`;
    const temporaryBackup = `${backup}.${randomUUID()}.tmp`;
    try {
      assertCurrent();
      await fs.mkdir(path.dirname(destination), { recursive: true });
      const handle = await fs.open(temporary, 'wx', 0o600);
      try { await handle.writeFile(serialized, 'utf8'); await handle.sync(); }
      finally { await handle.close(); }
      assertCurrent();
      let copied = false;
      try { await fs.copyFile(destination, temporaryBackup); copied = true; }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
      if (copied) {
        assertCurrent();
        await fs.rename(temporaryBackup, backup);
      }
      // Nunca retirar el principal antes de tener el reemplazo listo.
      assertCurrent();
      await fs.rename(temporary, destination);
    } finally {
      await fs.unlink(temporary).catch(() => undefined);
      await fs.unlink(temporaryBackup).catch(() => undefined);
    }
  }
}

async function readBookmarkBytes(filename: string): Promise<string | null> {
  try {
    const handle = await fs.open(filename, 'r');
    try {
      const stat = await handle.stat();
      if (!stat.isFile() || stat.size > MAX_BOOKMARK_STORE_BYTES) throw new BookmarkImportRejected('El archivo de marcadores excede la cuota o no es un archivo regular.');
      const buffer = Buffer.alloc(Math.min(MAX_BOOKMARK_STORE_BYTES + 1, stat.size + 1));
      let length = 0;
      while (length < buffer.length) {
        const result = await handle.read(buffer, length, buffer.length - length, null);
        if (!result.bytesRead) break;
        length += result.bytesRead;
      }
      if (length !== stat.size || (await handle.stat()).size !== stat.size) throw new BookmarkImportRejected('El archivo de marcadores cambió durante la lectura.');
      return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(buffer.subarray(0, length));
    } finally { await handle.close(); }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    if (error instanceof BookmarkImportRejected) throw error;
    throw new BookmarkImportRejected('No se pudo leer el archivo de marcadores. Revisa el acceso al perfil.');
  }
}

async function writeBookmarkBytes(filename: string, raw: string): Promise<void> {
  const handle = await fs.open(filename, 'wx', 0o600);
  try { await handle.writeFile(raw, 'utf8'); await handle.sync(); }
  finally { await handle.close(); }
}

function parseBookmarkFile(raw: string): BookmarkFile {
  const value = JSON.parse(raw) as Partial<BookmarkFile> | null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new BookmarkImportRejected('El formato de marcadores no es válido.');
  if (value.version !== 1) throw new UnsupportedBookmarkVersion('La versión de marcadores no es compatible. Se conservaron los archivos.');
  if (!Array.isArray(value.bookmarks) || value.bookmarks.length > MAX_BOOKMARKS) throw new BookmarkImportRejected('El formato de marcadores no es válido.');
  const bookmarks = value.bookmarks.map(validateStoredBookmark);
  if (new Set(bookmarks.map((row) => row.id)).size !== bookmarks.length || new Set(bookmarks.map((row) => row.url)).size !== bookmarks.length) throw new BookmarkImportRejected('El archivo contiene marcadores duplicados.');
  return { version: 1, bookmarks };
}

function validateBookmark(raw: Partial<BrowserBookmark> & { url: string; title: string }) {
  if (!raw || typeof raw.url !== 'string' || raw.url.length > 2_048 || typeof raw.title !== 'string') throw new Error('El marcador es inválido.');
  if (raw.position !== undefined && (!Number.isSafeInteger(raw.position) || raw.position < 0 || raw.position >= MAX_BOOKMARKS)) throw new Error('El orden del marcador es inválido.');
  if (raw.folderId !== undefined && raw.folderId !== null && (typeof raw.folderId !== 'string' || raw.folderId.length > 100)) throw new Error('La carpeta no puede superar 100 caracteres.');
  const url = normalizeBookmarkUrl(raw.url);
  const title = raw.title.replace(/[\r\n\t]+/g, ' ').trim().slice(0, 200) || new URL(url).hostname;
  const tags = Array.isArray(raw.tags) ? [...new Set(raw.tags.filter((tag): tag is string => typeof tag === 'string').map((tag) => tag.trim().slice(0, 40)).filter(Boolean))].slice(0, 20) : [];
  const folderId = typeof raw.folderId === 'string' && raw.folderId.length <= 100 ? raw.folderId : null;
  return { id: typeof raw.id === 'string' ? raw.id : undefined, url, title, tags, folderId, position: raw.position };
}

function validateStoredBookmark(raw: BrowserBookmark): BrowserBookmark {
  if (!raw || typeof raw.id !== 'string' || !raw.id || raw.id.length > 100 || typeof raw.createdAt !== 'string' || !Number.isFinite(Date.parse(raw.createdAt))
    || typeof raw.updatedAt !== 'string' || !Number.isFinite(Date.parse(raw.updatedAt)) || !Number.isSafeInteger(raw.position)) throw new Error('Marcador inválido.');
  const validated = validateBookmark(raw);
  return { id: raw.id, url: validated.url, title: validated.title, tags: validated.tags, folderId: validated.folderId, position: raw.position, createdAt: raw.createdAt, updatedAt: raw.updatedAt };
}

function normalizeBookmarkUrl(raw: string): string {
  const url = new URL(raw);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('La URL del marcador no está permitida.');
  url.username = '';
  url.password = '';
  return url.toString();
}

function parseBookmarkHtml(html: string): Array<{ url: string; title: string; tags: string[]; folderId: string | null }> {
  const entries: Array<{ url: string; title: string; tags: string[]; folderId: string | null }> = [];
  const stack: Array<string | null> = [];
  let pendingFolder: string | null = null;
  const tokens = html.matchAll(/<h3\b[^>]*>([\s\S]*?)<\/h3\s*>|(<dl\b[^>]*>)|(<\/dl\s*>)|<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi);
  for (const match of tokens) {
    if (match[1] !== undefined) { pendingFolder = decodeHtmlEntities(match[1].replace(/<[^>]*>/g, '')).trim(); continue; }
    if (match[2]) {
      if (stack.length >= 20) throw new BookmarkImportRejected('La jerarquía de carpetas supera el límite.');
      stack.push(pendingFolder); pendingFolder = null; continue;
    }
    if (match[3]) { stack.pop(); continue; }
    if (entries.length >= MAX_BOOKMARKS) throw new BookmarkImportRejected('El archivo supera el límite de marcadores.');
    const attributes = match[4];
    const href = readHtmlAttribute(attributes, 'href');
    const tags = (readHtmlAttribute(attributes, 'tags') ?? '')
      .split(',')
      .map((tag) => decodeHtmlEntities(tag).trim())
      .filter(Boolean)
      .slice(0, 20);
    const title = decodeHtmlEntities(match[5].replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
    entries.push({ url: decodeHtmlEntities(href ?? ''), title: title || href || '', tags, folderId: stack.filter(Boolean).join('/') || null });
  }
  return entries;
}

function readHtmlAttribute(attributes: string, name: string): string | null {
  // Consumir cada valor completo evita confundir data-href o texto dentro de
  // otro atributo con una dirección de marcador.
  for (const match of attributes.matchAll(/(?:^|\s)([^\s=<>/]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
    if (match[1].toLowerCase() === name) return match[2] ?? match[3] ?? match[4] ?? '';
  }
  return null;
}

function decodeHtmlEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|amp|quot|apos|lt|gt);/gi, (entity, code: string) => {
    const normalized = code.toLowerCase();
    if (normalized === 'amp') return '&';
    if (normalized === 'quot') return '"';
    if (normalized === 'apos') return "'";
    if (normalized === 'lt') return '<';
    if (normalized === 'gt') return '>';
    const radix = normalized.startsWith('#x') ? 16 : 10;
    const numeric = Number.parseInt(normalized.replace(/^#x?/, ''), radix);
    return Number.isSafeInteger(numeric) && numeric >= 0 && numeric <= 0x10ffff ? String.fromCodePoint(numeric) : entity;
  });
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function bookmarkRevision(file: BookmarkFile): string {
  return createHash('sha256').update(JSON.stringify(file)).digest('hex');
}

function sameBookmarkMetadata(left: BrowserBookmark, right: ReturnType<typeof validateBookmark>): boolean {
  return left.title === right.title && left.folderId === right.folderId
    && JSON.stringify(left.tags) === JSON.stringify(right.tags);
}
