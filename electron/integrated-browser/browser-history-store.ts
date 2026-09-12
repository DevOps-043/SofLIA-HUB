import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { browserProfilePath, resolveStoreLocation } from './profile-scope';
import type { BrowserHistoryEntry } from './types';
import { initializeBrowserSchema } from './sqlite-schema';
import { assertSqlitePrincipal, DamagedSqliteData, eraseSqliteCopies, prepareSqliteRecovery, refreshSqliteBackup, sqliteDatabasePath, UnsupportedSqliteRecovery } from './sqlite-store-recovery';

const HISTORY_LIMIT = 50_000;
const QUERY_LIMIT = 200;
const DEFAULT_QUERY_LIMIT = 50;
const MAX_OFFSET = HISTORY_LIMIT;
const RETENTION_OPTIONS = [30, 90, 180, 365];

export interface BrowserHistoryImportEntry {
  url: string;
  title: string;
  visitedAt: string;
}

type HistoryQuery = {
  query?: unknown;
  limit?: unknown;
  offset?: unknown;
  from?: unknown;
  to?: unknown;
  domain?: unknown;
};

/** Historial SQLite por perfil con FTS5 y migración transaccional desde JSONL. */
export class BrowserHistoryStore {
  private writeQueue: Promise<void> = Promise.resolve();
  private connection: DatabaseSync | null = null;
  private connectedPath: string | null = null;
  private readonly managedRetention = new Map<string, number>();

  constructor(
    private readonly location: string | (() => string) = () => browserProfilePath('history.sqlite'),
    private readonly legacyLocation: string | (() => string) | null = () => browserProfilePath('history.jsonl'),
  ) {}

  async record(input: { url: string; title?: string; visitedAt?: string }): Promise<BrowserHistoryEntry | null> {
    const url = sanitizeHistoryUrl(input.url);
    if (!url) return null;
    const entry: BrowserHistoryEntry = { id: randomUUID(), url, title: sanitizeTitle(input.title), visitedAt: normalizeTimestamp(input.visitedAt) };
    let retained = true;
    await this.enqueue((database, legacy) => {
      const cutoff = this.retentionCutoff(database);
      this.enforceRetention(database, legacy, cutoff);
      if (cutoff !== null && Date.parse(entry.visitedAt) < cutoff) { retained = false; return; }
      database.exec('BEGIN IMMEDIATE');
      try {
        const previous = database.prepare(`SELECT visits.id, pages.url, visits.visited_at AS visitedAt FROM visits JOIN pages ON pages.id = visits.page_id ORDER BY visits.visited_at DESC LIMIT 1`).get() as { id: string; url: string; visitedAt: number } | undefined;
        const pageId = this.upsertPage(database, entry.url, entry.title);
        const visitedAt = Date.parse(entry.visitedAt);
        if (previous?.url === entry.url && visitedAt >= previous.visitedAt && visitedAt - previous.visitedAt < 2_000) {
          entry.id = previous.id;
          database.prepare('UPDATE visits SET page_id = ?, visited_at = ? WHERE id = ?').run(pageId, visitedAt, entry.id);
          database.prepare('DELETE FROM history_fts WHERE visit_id = ?').run(entry.id);
        } else {
          database.prepare('INSERT INTO visits (id, page_id, visited_at) VALUES (?, ?, ?)').run(entry.id, pageId, visitedAt);
        }
        database.prepare('INSERT INTO history_fts (visit_id, title, url) VALUES (?, ?, ?)').run(entry.id, entry.title, searchableUrl(entry.url));
        database.prepare('UPDATE history_fts SET title = ? WHERE visit_id IN (SELECT id FROM visits WHERE page_id = ?)').run(entry.title, pageId);
        this.trim(database);
        database.exec('COMMIT');
      } catch (error) {
        database.exec('ROLLBACK');
        throw error;
      }
    });
    return retained ? entry : null;
  }

  /** Inserta un lote revisado dentro de una sola transacción de SQLite. */
  async importEntries(entries: readonly BrowserHistoryImportEntry[], assertCurrent: () => void = () => {}): Promise<{ imported: number; skipped: number }> {
    if (!Array.isArray(entries) || entries.length > HISTORY_LIMIT) throw new Error('La importación de historial supera el límite permitido.');
    let imported = 0;
    let skipped = 0;
    await this.enqueue((database) => {
      assertCurrent();
      database.exec('BEGIN IMMEDIATE');
      try {
        const cutoff = this.retentionCutoff(database);
        for (const input of entries) {
          assertCurrent();
          const url = sanitizeHistoryUrl(input.url);
          if (!url || typeof input.visitedAt !== 'string' || Number.isNaN(Date.parse(input.visitedAt))) { skipped++; continue; }
          const visitedAt = Date.parse(input.visitedAt);
          const title = sanitizeTitle(input.title);
          if (cutoff !== null && visitedAt < cutoff) { skipped++; continue; }
          const knownPage = database.prepare('SELECT id FROM pages WHERE url = ?').get(url) as { id?: number } | undefined;
          const existing = knownPage?.id
            ? database.prepare('SELECT id FROM visits WHERE page_id = ? AND visited_at = ? LIMIT 1').get(knownPage.id, visitedAt) as { id?: string } | undefined
            : undefined;
          if (existing?.id) { skipped++; continue; }
          const pageId = this.upsertPage(database, url, title);
          const id = randomUUID();
          database.prepare('INSERT INTO visits (id, page_id, visited_at) VALUES (?, ?, ?)').run(id, pageId, visitedAt);
          database.prepare('INSERT INTO history_fts (visit_id, title, url) VALUES (?, ?, ?)').run(id, title, searchableUrl(url));
          database.prepare('UPDATE history_fts SET title = ? WHERE visit_id IN (SELECT id FROM visits WHERE page_id = ?)').run(title, pageId);
          imported++;
        }
        this.trim(database);
        assertCurrent();
        database.exec('COMMIT');
      } catch (error) {
        database.exec('ROLLBACK');
        throw error;
      }
    });
    return { imported, skipped };
  }

  async list(input: HistoryQuery = {}): Promise<BrowserHistoryEntry[]> {
    const query = normalizeQuery(input.query);
    const limit = normalizeLimit(input.limit);
    const offset = normalizeOffset(input.offset);
    const range = normalizeRange(input.from, input.to);
    const domain = normalizeDomain(input.domain);
    const clauses: string[] = [];
    const parameters: Array<string | number> = [];
    let ftsJoin = '';
    if (query) {
      ftsJoin = 'JOIN history_fts ON history_fts.visit_id = visits.id';
      clauses.push('history_fts MATCH ?');
      parameters.push(toFtsQuery(query));
    }
    if (range.from !== null) { clauses.push('visits.visited_at >= ?'); parameters.push(range.from); }
    if (range.to !== null) { clauses.push('visits.visited_at <= ?'); parameters.push(range.to); }
    if (domain) { clauses.push('(pages.origin IN (?, ?, ?, ?))'); parameters.push(`https://${domain}`, `http://${domain}`, `https://www.${domain}`, `http://www.${domain}`); }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    let entries: BrowserHistoryEntry[] = [];
    await this.enqueue((database, legacy) => {
    this.enforceRetention(database, legacy, this.retentionCutoff(database));
    const rows = database.prepare(`
      SELECT visits.id, pages.url, pages.title, visits.visited_at AS visitedAt
      FROM visits JOIN pages ON pages.id = visits.page_id ${ftsJoin}
      ${where} ORDER BY visits.visited_at DESC LIMIT ? OFFSET ?
    `).all(...parameters, limit, offset) as Array<{ id: string; url: string; title: string; visitedAt: number }>;
    entries = rows.map((row) => ({ id: row.id, url: row.url, title: row.title, visitedAt: new Date(row.visitedAt).toISOString() }));
    });
    return entries;
  }

  async clear(): Promise<void> {
    await this.clearSince(null);
  }

  async clearSince(sinceIso: string | null): Promise<number> {
    if (sinceIso !== null && Number.isNaN(Date.parse(sinceIso))) throw new Error('El rango de borrado no es una fecha valida.');
    let removed = 0;
    await this.enqueue((database, legacy) => {
      const condition = sinceIso === null ? '' : 'WHERE visited_at >= ?';
      const parameters = sinceIso === null ? [] : [Date.parse(sinceIso)];
      removed = (database.prepare(`SELECT COUNT(*) AS count FROM visits ${condition}`).get(...parameters) as { count: number }).count;
      this.beforeErase(database, legacy);
      database.exec('BEGIN IMMEDIATE');
      try {
        if (sinceIso === null) {
          database.exec('DELETE FROM history_fts; DELETE FROM visits; DELETE FROM pages;');
        } else {
          database.prepare('DELETE FROM history_fts WHERE visit_id IN (SELECT id FROM visits WHERE visited_at >= ?)').run(parameters[0]);
          database.prepare('DELETE FROM visits WHERE visited_at >= ?').run(parameters[0]);
          database.exec('DELETE FROM pages WHERE id NOT IN (SELECT DISTINCT page_id FROM visits)');
        }
        database.exec('COMMIT');
      } catch (error) {
        database.exec('ROLLBACK');
        throw error;
      }
      this.eraseDeletedData(database, legacy);
    });
    return removed;
  }

  async pruneOlderThan(cutoffIso: string): Promise<number> {
    const cutoff = Date.parse(cutoffIso);
    if (Number.isNaN(cutoff)) throw new Error('La retención del historial es inválida.');
    let removed = 0;
    await this.enqueue((database, legacy) => {
      removed = (database.prepare('SELECT COUNT(*) AS count FROM visits WHERE visited_at < ?').get(cutoff) as { count: number }).count;
      this.beforeErase(database, legacy);
      database.exec('BEGIN IMMEDIATE');
      try {
        database.prepare('DELETE FROM history_fts WHERE visit_id IN (SELECT id FROM visits WHERE visited_at < ?)').run(cutoff);
        database.prepare('DELETE FROM visits WHERE visited_at < ?').run(cutoff);
        database.exec('DELETE FROM pages WHERE id NOT IN (SELECT DISTINCT page_id FROM visits); COMMIT;');
      } catch (error) {
        database.exec('ROLLBACK');
        throw error;
      }
      this.eraseDeletedData(database, legacy);
    });
    return removed;
  }

  async getRetention(): Promise<number | null> {
    let days: number | null = null;
    await this.enqueue((database) => { days = this.retentionDays(database); });
    return days;
  }

  async setRetention(days: number | null): Promise<{ days: number | null; removed: number }> {
    if (days !== null && !RETENTION_OPTIONS.includes(days)) throw new Error('La retención debe ser 30, 90, 180 o 365 días, o sin límite temporal.');
    let removed = 0;
    await this.enqueue((database, legacy) => {
      this.beforeErase(database, legacy);
      database.prepare("INSERT INTO history_meta(key, value) VALUES('retention-days', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(days === null ? 'all' : String(days));
      removed = this.enforceRetention(database, legacy, this.retentionCutoff(database), days !== null);
    });
    return { days, removed };
  }

  async setManagedRetention(days: number | null): Promise<void> {
    if (days !== null && (!Number.isSafeInteger(days) || days < 0 || days > 3650)) throw new Error('La retención administrada es inválida.');
    const destination = resolveStoreLocation(this.location);
    await this.enqueue((database, legacy) => {
      if (days !== null) this.beforeErase(database, legacy);
      if (days === null) this.managedRetention.delete(destination);
      else this.managedRetention.set(destination, days);
      this.enforceRetention(database, legacy, this.retentionCutoff(database), days !== null);
    });
  }

  private retentionDays(database: DatabaseSync): number | null {
    const row = database.prepare("SELECT value FROM history_meta WHERE key = 'retention-days'").get() as { value: string } | undefined;
    const saved = !row || row.value === 'all' ? null : Number(row.value);
    if (saved !== null && !RETENTION_OPTIONS.includes(saved)) throw new Error('La configuración de retención del historial está dañada.');
    const managed = this.connectedPath ? this.managedRetention.get(this.connectedPath) : undefined;
    return managed === undefined ? saved : saved === null ? managed : Math.min(saved, managed);
  }

  private retentionCutoff(database: DatabaseSync): number | null {
    const days = this.retentionDays(database);
    return days === null ? null : Date.now() - days * 86_400_000;
  }

  private enforceRetention(database: DatabaseSync, legacy: string | null, cutoff: number | null, eraseBackup = false): number {
    if (cutoff === null) return 0;
    const removed = (database.prepare('SELECT COUNT(*) AS count FROM visits WHERE visited_at < ?').get(cutoff) as { count: number }).count;
    if (removed) {
      this.beforeErase(database, legacy);
      database.exec('BEGIN IMMEDIATE');
      try {
        database.prepare('DELETE FROM history_fts WHERE visit_id IN (SELECT id FROM visits WHERE visited_at < ?)').run(cutoff);
        database.prepare('DELETE FROM visits WHERE visited_at < ?').run(cutoff);
        database.exec('DELETE FROM pages WHERE id NOT IN (SELECT DISTINCT page_id FROM visits); COMMIT;');
      } catch (error) { database.exec('ROLLBACK'); throw error; }
    }
    if (removed || eraseBackup) this.eraseDeletedData(database, legacy);
    return removed;
  }

  close(): void {
    this.connection?.close();
    this.connection = null;
    this.connectedPath = null;
  }

  async flushAndClose(): Promise<void> {
    await this.writeQueue;
    this.close();
  }

  async prepareRecovery(guard: () => void) {
    const destination = path.resolve(resolveStoreLocation(this.location));
    const current = () => { guard(); if (path.resolve(resolveStoreLocation(this.location)) !== destination) throw new Error('El perfil del historial cambió.'); };
    await this.writeQueue; current(); this.close();
    const schema = {
      validate: validateHistoryRecovery,
      restrict: (db: DatabaseSync) => {
        const saved = db.prepare("SELECT value FROM history_meta WHERE key='retention-days'").get()?.value;
        const days = saved === undefined || saved === 'all' ? null : Number(saved);
        const managed = this.managedRetention.get(destination);
        const retention = managed === undefined ? days : days === null ? managed : Math.min(days, managed);
        if (retention !== null) {
          db.prepare('DELETE FROM visits WHERE visited_at < ?').run(Date.now() - retention * 86_400_000);
          db.exec('DELETE FROM pages WHERE id NOT IN (SELECT DISTINCT page_id FROM visits)');
        }
        // No reimportar un JSONL anterior después de recuperar una instantánea.
        db.exec("INSERT OR REPLACE INTO history_meta VALUES('jsonl-migrated','1'); DELETE FROM history_fts;");
        const insert = db.prepare('INSERT INTO history_fts(visit_id,title,url) VALUES(?,?,?)');
        for (const row of db.prepare('SELECT visits.id,pages.title,pages.url FROM visits JOIN pages ON pages.id=visits.page_id').all()) insert.run(row.id, row.title, searchableUrl(String(row.url)));
      },
    };
    const review = prepareSqliteRecovery(destination, schema, current);
    return { get count() { return review.count; }, commit: async () => {
      const pending = this.writeQueue.then(() => { current(); this.close(); review.commit(); });
      this.writeQueue = pending.catch(() => undefined); await pending;
    } };
  }

  private async enqueue(operation: (database: DatabaseSync, legacy: string | null) => void | Promise<void>): Promise<void> {
    const destination = resolveStoreLocation(this.location);
    const legacy = this.legacyPath();
    const pending = this.writeQueue.then(async () => {
      const db = this.database(destination, legacy); await operation(db, legacy);
      refreshSqliteBackup(destination, db, validateHistoryRecovery);
    });
    this.writeQueue = pending.catch(() => undefined);
    await pending;
  }

  private legacyPath(): string | null { return this.legacyLocation ? resolveStoreLocation(this.legacyLocation) : null; }

  private database(destination: string, legacy: string | null): DatabaseSync {
    if (this.connection && this.connectedPath === destination) return this.connection;
    this.close();
    assertSqlitePrincipal(destination);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    const database = new DatabaseSync(destination);
    try {
    initializeBrowserSchema(database, () => database.exec(`
      CREATE TABLE IF NOT EXISTS history_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS pages (id INTEGER PRIMARY KEY, url TEXT NOT NULL UNIQUE, title TEXT NOT NULL, origin TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS visits (id TEXT PRIMARY KEY, page_id INTEGER NOT NULL REFERENCES pages(id) ON DELETE CASCADE, visited_at INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS visits_visited_at_idx ON visits(visited_at DESC);
      CREATE VIRTUAL TABLE IF NOT EXISTS history_fts USING fts5(visit_id UNINDEXED, title, url, tokenize = 'unicode61 remove_diacritics 2');
    `), () => {
      database.prepare('SELECT key, value FROM history_meta LIMIT 0').all();
      database.prepare('SELECT id, url, title, origin FROM pages LIMIT 0').all();
      database.prepare('SELECT id, page_id, visited_at FROM visits LIMIT 0').all();
      database.prepare('SELECT visit_id, title, url FROM history_fts LIMIT 0').all();
    });
    database.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA secure_delete=ON;');
    database.exec("INSERT INTO history_fts(history_fts, rank) VALUES('secure-delete', 1)");
    this.migrateLegacy(database, legacy, destination);
    this.connection = database;
    this.connectedPath = destination;
    return database;
    } catch (error) {
      database.close();
      throw error;
    }
  }

  private migrateLegacy(database: DatabaseSync, legacy: string | null, destination: string): void {
    if (!legacy || legacy === destination || !fs.existsSync(legacy)) return;
    if (database.prepare("SELECT value FROM history_meta WHERE key = 'jsonl-migrated'").get()) return;
    if (fs.statSync(legacy).size > 64 * 1024 * 1024) throw new Error('El historial legado supera la cuota de migración.');
    const lines = fs.readFileSync(legacy, 'utf8').split(/\r?\n/);
    database.exec('BEGIN IMMEDIATE');
    try {
      for (const line of lines) {
        if (!line.trim()) continue;
        let parsed: Partial<BrowserHistoryEntry> | null;
        try { parsed = JSON.parse(line) as Partial<BrowserHistoryEntry>; }
        catch { continue; /* Una línea dañada no invalida los registros restantes. */ }
        if (parsed && typeof parsed === 'object') {
          const url = sanitizeHistoryUrl(parsed.url);
          if (!parsed.id || !url || !parsed.visitedAt || Number.isNaN(Date.parse(parsed.visitedAt))) continue;
          const title = sanitizeTitle(parsed.title);
          const pageId = this.upsertPage(database, url, title);
          const inserted = database.prepare('INSERT OR IGNORE INTO visits (id, page_id, visited_at) VALUES (?, ?, ?)').run(String(parsed.id), pageId, Date.parse(parsed.visitedAt));
          if (inserted.changes) database.prepare('INSERT INTO history_fts (visit_id, title, url) VALUES (?, ?, ?)').run(String(parsed.id), title, searchableUrl(url));
        }
      }
      this.trim(database);
      database.exec("INSERT INTO history_meta(key, value) VALUES('jsonl-migrated', '1')");
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
    // El marcador transaccional impide reimportar aunque falle mover el respaldo.
    try {
      if (fs.existsSync(legacy) && !fs.existsSync(`${legacy}.migrated`)) fs.renameSync(legacy, `${legacy}.migrated`);
    } catch { console.warn('[Navegador][Historial] La migración terminó; el respaldo legado sigue en su ubicación original.'); }
  }

  private upsertPage(database: DatabaseSync, url: string, title: string): number {
    database.prepare(`INSERT INTO pages (url, title, origin) VALUES (?, ?, ?) ON CONFLICT(url) DO UPDATE SET title = excluded.title, origin = excluded.origin`).run(url, title, new URL(url).origin);
    return (database.prepare('SELECT id FROM pages WHERE url = ?').get(url) as { id: number }).id;
  }

  private trim(database: DatabaseSync): void {
    if (Number(database.prepare('SELECT COUNT(*) AS count FROM visits').get()?.count) > HISTORY_LIMIT) this.beforeErase(database, this.legacyPath());
    database.prepare('DELETE FROM history_fts WHERE visit_id IN (SELECT id FROM visits ORDER BY visited_at DESC LIMIT -1 OFFSET ?)').run(HISTORY_LIMIT);
    database.prepare('DELETE FROM visits WHERE id IN (SELECT id FROM visits ORDER BY visited_at DESC LIMIT -1 OFFSET ?)').run(HISTORY_LIMIT);
    database.exec('DELETE FROM pages WHERE id NOT IN (SELECT DISTINCT page_id FROM visits)');
  }

  private eraseDeletedData(database: DatabaseSync, legacy: string | null): void {
    this.beforeErase(database, legacy);
    database.exec('PRAGMA wal_checkpoint(TRUNCATE); VACUUM; PRAGMA wal_checkpoint(TRUNCATE);');
  }
  private beforeErase(database: DatabaseSync, legacy: string | null): void {
    eraseSqliteCopies(sqliteDatabasePath(database));
    // El borrado solicitado incluye respaldos JSONL que conservan esas visitas.
    if (legacy) for (const file of [legacy, `${legacy}.migrated`]) {
      try { fs.unlinkSync(file); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    }
  }
}

function validateHistoryRecovery(db: DatabaseSync): number {
  const expected = ['history_meta', 'pages', 'visits', 'history_fts', 'history_fts_data', 'history_fts_idx', 'history_fts_content', 'history_fts_docsize', 'history_fts_config'];
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
  if (tables.length !== expected.length || tables.some(row => !expected.includes(String(row.name)))) throw new UnsupportedSqliteRecovery();
  db.prepare('SELECT key,value FROM history_meta LIMIT 0').all(); db.prepare('SELECT id,page_id,visited_at FROM visits LIMIT 0').all();
  db.prepare('SELECT id,url,title,origin FROM pages LIMIT 0').all(); db.prepare('SELECT visit_id,title,url FROM history_fts LIMIT 0').all();
  const days = db.prepare("SELECT value FROM history_meta WHERE key='retention-days'").get()?.value;
  if (days !== undefined && days !== 'all' && !RETENTION_OPTIONS.includes(Number(days))) throw new DamagedSqliteData();
  const count = Number(db.prepare('SELECT COUNT(*) AS total FROM visits').get()?.total);
  if (count > HISTORY_LIMIT) throw new UnsupportedSqliteRecovery();
  if (db.prepare('PRAGMA foreign_key_check').all().length || Number(db.prepare('SELECT COUNT(*) AS total FROM history_fts').get()?.total) !== count) throw new DamagedSqliteData();
  if (Number(db.prepare('SELECT COUNT(DISTINCT visit_id) AS total FROM history_fts').get()?.total) !== count
    || Number(db.prepare('SELECT COUNT(*) AS total FROM history_fts LEFT JOIN visits ON visits.id=history_fts.visit_id WHERE visits.id IS NULL').get()?.total)) throw new DamagedSqliteData();
  for (const row of db.prepare('SELECT visits.id,visits.visited_at,pages.url,pages.title,pages.origin FROM visits JOIN pages ON pages.id=visits.page_id').all()) {
    if (typeof row.id !== 'string' || !row.id || typeof row.url !== 'string' || sanitizeHistoryUrl(row.url) !== row.url || sanitizeTitle(row.title) !== row.title
      || new URL(row.url).origin !== row.origin || !Number.isSafeInteger(row.visited_at) || Number(row.visited_at) < 0 || Number(row.visited_at) > 8_640_000_000_000_000) throw new DamagedSqliteData();
  }
  return count;
}

export function sanitizeHistoryUrl(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.length > 2_048) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    url.username = '';
    url.password = '';
    return url.toString();
  } catch { return null; }
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

function normalizeOffset(raw: unknown): number {
  return typeof raw === 'number' && Number.isSafeInteger(raw) ? Math.min(MAX_OFFSET, Math.max(0, raw)) : 0;
}

function normalizeQuery(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim().slice(0, 200) : '';
}

function normalizeRange(from: unknown, to: unknown): { from: number | null; to: number | null } {
  const parse = (value: unknown) => typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? Date.parse(value) : null;
  const result = { from: parse(from), to: parse(to) };
  if (result.from !== null && result.to !== null && result.from > result.to) throw new Error('El rango del historial es inválido.');
  return result;
}

function normalizeDomain(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const domain = raw.trim().toLowerCase().replace(/^www\./, '');
  return /^[a-z0-9.-]+$/.test(domain) && !domain.includes('..') ? domain.slice(0, 253) : null;
}

function searchableUrl(url: string): string {
  return `${url} ${url.replace(/^https?:\/\//, '').replace(/^www\./, '')}`;
}

function toFtsQuery(query: string): string {
  const tokens = query.toLocaleLowerCase('es').match(/[\p{L}\p{N}]+/gu)?.slice(0, 12) ?? [];
  if (tokens.length === 0) return '"__sin_resultados__"';
  return tokens.map((token) => `"${token.replace(/"/g, '""')}"*`).join(' AND ');
}
