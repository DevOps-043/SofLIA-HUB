import fs from 'node:fs';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { safeStorage } from 'electron';
import { browserProfilePath, resolveStoreLocation } from './profile-scope';
import { initializeBrowserSchema } from './sqlite-schema';
import { assertSqlitePrincipal, DamagedSqliteData, eraseSqliteCopies, prepareSqliteRecovery, refreshSqliteBackup, sqliteDatabasePath, UnsupportedSqliteRecovery } from './sqlite-store-recovery';

export const AUDIT_OPERATIONS = ['dom', 'document', 'capture', 'click', 'type', 'scroll', 'policy',
  'cu-capture', 'cu-click', 'cu-double_click', 'cu-right_click', 'cu-middle_click', 'cu-move', 'cu-mouse_down',
  'cu-mouse_up', 'cu-type', 'cu-key', 'cu-scroll', 'cu-drag', 'cu-wait', 'cu-navigate', 'cu-go_back',
  'cu-go_forward', 'cu-screenshot', 'cu-desconocida'] as const;
export type BrowserAuditOperation = typeof AUDIT_OPERATIONS[number];
export type BrowserAuditResult = 'started' | 'completed' | 'failed' | 'cancelled' | 'allowed' | 'blocked';
export interface BrowserAuditEntry {
  id: string; traceId: string; tab: string; origin: string | null; at: number;
  operation: BrowserAuditOperation; result: BrowserAuditResult; confirmation: 'none' | 'accepted' | 'rejected';
}
export interface BrowserAuditPage { entries: BrowserAuditEntry[]; total: number; offset: number; retentionDays: number }
const RESULTS = ['started', 'completed', 'failed', 'cancelled', 'allowed', 'blocked'];
const DAYS = [7, 30, 90];
const LIMIT = 5_000;
const uuid = /^[a-f0-9-]{36}$/i;
export class BrowserAuditError extends Error {}
function failure(): BrowserAuditError { return new BrowserAuditError('No se pudo leer o guardar la bitácora cifrada. Se conserva el archivo.'); }
function secure() {
  if (!safeStorage.isEncryptionAvailable() || (process.platform === 'linux' && safeStorage.getSelectedStorageBackend() === 'basic_text')) throw failure();
}
function originOnly(raw: string): string | null {
  try { const value = new URL(raw); return ['https:', 'http:'].includes(value.protocol) ? value.origin : null; }
  catch { return null; }
}
function validate(raw: unknown): BrowserAuditEntry {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw failure();
  const entry = raw as BrowserAuditEntry;
  if (Object.keys(entry).sort().join(',') !== 'at,confirmation,id,operation,origin,result,tab,traceId'
    || !uuid.test(entry.id) || !uuid.test(entry.traceId) || !/^[a-f0-9]{24}$/.test(entry.tab)
    || !Number.isSafeInteger(entry.at) || entry.at < 0 || !AUDIT_OPERATIONS.includes(entry.operation)
    || !RESULTS.includes(entry.result) || !['none', 'accepted', 'rejected'].includes(entry.confirmation)
    || (entry.origin !== null && (typeof entry.origin !== 'string' || entry.origin.length > 512 || originOnly(entry.origin) !== entry.origin))) throw failure();
  return entry;
}

/** SQLite indexa sólo fechas e IDs aleatorios; todo el detalle está cifrado y ligado al perfil. */
export class BrowserAgentAuditStore {
  constructor(private readonly location: string | (() => string) = () => browserProfilePath('agent-audit.sqlite')) {}
  private database<T>(operation: (db: DatabaseSync, scope: string) => T): T {
    secure();
    const destination = path.resolve(resolveStoreLocation(this.location));
    let db: DatabaseSync | undefined;
    try {
      assertSqlitePrincipal(destination);
      if (fs.existsSync(destination) && fs.statSync(destination).size > 16 * 1024 * 1024) throw failure();
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      db = new DatabaseSync(destination);
      const current = db;
      initializeBrowserSchema(current, () => current.exec('CREATE TABLE events (id TEXT PRIMARY KEY, at INTEGER NOT NULL, payload TEXT NOT NULL); CREATE INDEX events_at ON events(at); CREATE TABLE settings (id INTEGER PRIMARY KEY CHECK(id=1), days INTEGER NOT NULL CHECK(days IN (7,30,90))); INSERT INTO settings VALUES(1,30);'), () => {
        current.prepare('SELECT id, at, payload FROM events LIMIT 0').all();
        const days = Number(current.prepare('SELECT days FROM settings WHERE id=1').get()?.days);
        if (!DAYS.includes(days)) throw failure();
      });
      db.exec('PRAGMA secure_delete=ON; PRAGMA journal_mode=DELETE; PRAGMA busy_timeout=1000;');
      const result = operation(db, path.basename(path.dirname(destination)));
      refreshSqliteBackup(destination, db, current => validateAuditRecovery(current, path.basename(path.dirname(destination)))); return result;
    } catch (error) { if (error instanceof BrowserAuditError) throw error; throw failure(); }
    finally { db?.close(); }
  }
  private prune(db: DatabaseSync): number {
    const days = Number(db.prepare('SELECT days FROM settings WHERE id=1').get()?.days);
    if (!DAYS.includes(days)) throw failure();
    if (Number(db.prepare('SELECT COUNT(*) AS total FROM events WHERE at < ?').get(Date.now() - days * 86_400_000)?.total) > 0
      || Number(db.prepare('SELECT COUNT(*) AS total FROM events').get()?.total) > LIMIT) eraseSqliteCopies(sqliteDatabasePath(db));
    db.prepare('DELETE FROM events WHERE at < ?').run(Date.now() - days * 86_400_000);
    db.exec('DELETE FROM events WHERE id IN (SELECT id FROM events ORDER BY at DESC, rowid DESC LIMIT -1 OFFSET 5000)');
    return days;
  }
  record(input: { traceId: string; tabId: string; url: string; operation: BrowserAuditOperation; result: BrowserAuditResult; confirmation?: BrowserAuditEntry['confirmation'] }): void {
    const entry = validate({ id: randomUUID(), traceId: input.traceId,
      tab: createHash('sha256').update(input.tabId).digest('hex').slice(0, 24), origin: originOnly(input.url),
      at: Date.now(), operation: input.operation, result: input.result, confirmation: input.confirmation ?? 'none' });
    this.database((db, scope) => {
      const payload = safeStorage.encryptString(JSON.stringify({ scope, entry })).toString('base64');
      db.exec('BEGIN IMMEDIATE');
      try { db.prepare('INSERT INTO events VALUES(?,?,?)').run(entry.id, entry.at, payload); this.prune(db); db.exec('COMMIT'); }
      catch (error) { db.exec('ROLLBACK'); throw error; }
    });
  }
  list(offset = 0): BrowserAuditPage {
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > LIMIT) throw new BrowserAuditError('La página de bitácora no es válida.');
    return this.database((db, scope) => {
      const retentionDays = this.prune(db);
      const rows = db.prepare('SELECT id, at, payload FROM events ORDER BY at DESC, rowid DESC LIMIT 50 OFFSET ?').all(offset);
      const entries = rows.map(row => decodeAuditRow(row, scope));
      return { entries, total: Number(db.prepare('SELECT COUNT(*) AS total FROM events').get()?.total), offset, retentionDays };
    });
  }
  setRetention(days: number): void {
    if (!DAYS.includes(days)) throw new BrowserAuditError('La retención debe ser de 7, 30 o 90 días.');
    this.database((db) => { eraseSqliteCopies(sqliteDatabasePath(db)); db.prepare('UPDATE settings SET days=? WHERE id=1').run(days); this.prune(db); });
  }
  clear(): void { this.database((db) => { eraseSqliteCopies(sqliteDatabasePath(db)); db.exec('DELETE FROM events; VACUUM;'); }); }
  prepareRecovery(guard: () => void) {
    const destination = path.resolve(resolveStoreLocation(this.location)); const scope = path.basename(path.dirname(destination));
    if (fs.existsSync(destination) && fs.lstatSync(destination).size > 16 * 1024 * 1024) throw failure();
    const current = () => { guard(); if (path.resolve(resolveStoreLocation(this.location)) !== destination) throw new Error('El perfil de bitácora cambió.'); };
    const review = prepareSqliteRecovery(destination, {
      validate: db => validateAuditRecovery(db, scope),
      restrict: db => { const days = Number(db.prepare('SELECT days FROM settings WHERE id=1').get()?.days); db.prepare('DELETE FROM events WHERE at < ?').run(Date.now() - days * 86_400_000); },
    }, current);
    return { get count() { return review.count; }, commit: async () => { review.commit(); } };
  }
}
function validateAuditRecovery(db: DatabaseSync, scope: string): number {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
  if (tables.length !== 2 || tables.some(row => !['events', 'settings'].includes(String(row.name)))) throw new UnsupportedSqliteRecovery();
  const days = Number(db.prepare('SELECT days FROM settings WHERE id=1').get()?.days);
  if (!DAYS.includes(days)) throw new DamagedSqliteData();
  const rows = db.prepare('SELECT id, at, payload FROM events').all();
  if (rows.length > LIMIT) throw new UnsupportedSqliteRecovery();
  for (const row of rows) decodeAuditRow(row, scope); return rows.length;
}
function decodeAuditRow(row: Record<string, unknown>, scope: string): BrowserAuditEntry {
  try {
    if (typeof row.payload !== 'string') throw failure();
    if (row.payload.length > 16_384) throw new UnsupportedSqliteRecovery();
    const bytes = Buffer.from(row.payload, 'base64'); if (bytes.toString('base64') !== row.payload) throw failure();
    const decrypted = JSON.parse(safeStorage.decryptString(bytes));
    if (decrypted.scope !== scope) throw new UnsupportedSqliteRecovery();
    if (Object.keys(decrypted).sort().join(',') !== 'entry,scope') throw failure();
    const entry = validate(decrypted.entry); if (entry.id !== row.id || entry.at !== row.at) throw failure(); return entry;
  } catch (cause) { if (cause instanceof UnsupportedSqliteRecovery) throw cause; throw new DamagedSqliteData(); }
}
