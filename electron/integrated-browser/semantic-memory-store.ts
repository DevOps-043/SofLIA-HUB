import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { safeStorage } from 'electron';
import { browserProfilePath } from './profile-scope';
import { initializeBrowserSchema } from './sqlite-schema';
import { DamagedSemanticSnapshot, UnsupportedSemanticRecovery, ensureSemanticRecovery, forgetDamagedSemanticCopies, prepareSemanticRecovery, semanticRecoveryPath } from './semantic-memory-recovery';
import { BROWSER_SEMANTIC_LIMITS as LIMIT, type BrowserSemanticSource } from '../../src/shared/browser-semantic-memory';

export interface SemanticEntry extends BrowserSemanticSource { vector: number[] }
export interface SemanticSnapshot { enabled: boolean; indexedAt: number | null; entries: SemanticEntry[] }
export const EMPTY_SEMANTIC_SNAPSHOT = (): SemanticSnapshot => ({ enabled: false, indexedAt: null, entries: [] });
export function normalizeSemanticVector(raw: unknown): number[] {
  if (!Array.isArray(raw) || raw.length !== LIMIT.dimensions || !raw.every(n => typeof n === 'number' && Number.isFinite(n))) throw new Error('Vector inválido.');
  const norm = Math.hypot(...raw);
  if (!Number.isFinite(norm) || norm < 1e-12) throw new Error('Vector vacío.');
  return raw.map(n => n / norm);
}
export function semanticSource(input: BrowserSemanticSource): BrowserSemanticSource | null {
  if (!['history', 'bookmark'].includes(input.source) || typeof input.id !== 'string' || !input.id || input.id.length > 100 || typeof input.title !== 'string' || typeof input.url !== 'string') return null;
  try {
    const url = new URL(input.url);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return null;
    url.search = ''; url.hash = '';
    if (url.href.length > LIMIT.url) return null;
    return { id: input.id, source: input.source, title: input.title.replace(/\p{Cc}/gu, '').slice(0, LIMIT.title), url: url.href };
  } catch { return null; }
}
function validate(raw: SemanticSnapshot): SemanticSnapshot {
  if (!raw || Object.keys(raw).sort().join(',') !== 'enabled,entries,indexedAt' || typeof raw.enabled !== 'boolean' || !Array.isArray(raw.entries) || raw.entries.length > LIMIT.count
    || (raw.indexedAt !== null && (!Number.isSafeInteger(raw.indexedAt) || raw.indexedAt < 0 || raw.indexedAt > Date.now()))
    || ((!raw.enabled || raw.indexedAt === null) && raw.entries.length)) throw new Error('Índice inválido.');
  const seen = new Set<string>();
  for (const entry of raw.entries) {
    if (!entry || Object.keys(entry).sort().join(',') !== 'id,source,title,url,vector') throw new Error('Entrada inválida.');
    const source = semanticSource(entry);
    if (!source || source.title !== entry.title || source.url !== entry.url || seen.has(`${entry.source}:${entry.id}`)) throw new Error('Fuente inválida.');
    seen.add(`${entry.source}:${entry.id}`); normalizeSemanticVector(entry.vector);
  }
  return raw;
}

/** Una instantánea transaccional SQLite; fuentes y vectores sólo existen cifrados en disco. */
export class BrowserSemanticMemoryStore {
  path(): string { return path.resolve(browserProfilePath('semantic-memory.sqlite')); }
  private use<T>(location: string, action: (db: DatabaseSync) => T): T {
    let db: DatabaseSync | undefined;
    try {
      if (!safeStorage.isEncryptionAvailable() || (process.platform === 'linux' && safeStorage.getSelectedStorageBackend() === 'basic_text')) throw new Error();
      let stat: fs.Stats | undefined;
      try { stat = fs.lstatSync(location); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
      if (stat) { if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 16 * 1024 * 1024) throw new Error(); }
      else if (fs.existsSync(semanticRecoveryPath(location))) throw new Error();
      fs.mkdirSync(path.dirname(location), { recursive: true });
      db = new DatabaseSync(location);
      const current = db;
      initializeBrowserSchema(current, () => current.exec('CREATE TABLE snapshot (id INTEGER PRIMARY KEY CHECK(id=1), payload BLOB NOT NULL);'),
        () => { current.prepare('SELECT id, payload FROM snapshot LIMIT 0').all(); });
      db.exec('PRAGMA secure_delete=ON; PRAGMA journal_mode=DELETE; PRAGMA busy_timeout=1000;');
      return action(db);
    } catch { throw new Error('No se pudo abrir o guardar la memoria cifrada. Se conserva el índice anterior.'); }
    finally { db?.close(); }
  }
  read(location: string): SemanticSnapshot {
    return this.use(location, db => this.snapshot(db, location));
  }
  private snapshot(db: DatabaseSync, location: string): SemanticSnapshot {
    try {
      const row = db.prepare('SELECT payload FROM snapshot WHERE id=1').get();
      if (!row) return EMPTY_SEMANTIC_SNAPSHOT();
      if (!(row.payload instanceof Uint8Array)) throw new Error();
      if (row.payload.byteLength > 12 * 1024 * 1024) throw new UnsupportedSemanticRecovery();
      const decoded = JSON.parse(safeStorage.decryptString(Buffer.from(row.payload)));
      if (decoded.scope !== location) throw new UnsupportedSemanticRecovery();
      if (Object.keys(decoded).sort().join(',') !== 'scope,snapshot') throw new Error();
      return validate(decoded.snapshot);
    } catch (error) { if (error instanceof UnsupportedSemanticRecovery) throw error; throw new DamagedSemanticSnapshot(); }
  }
  prepareRecovery(guard: () => void) {
    const location = this.path();
    return prepareSemanticRecovery(location, db => { this.snapshot(db, location); }, guard);
  }
  write(location: string, snapshot: SemanticSnapshot, guard: () => void): void {
    guard(); validate(snapshot);
    this.use(location, db => {
      // No reemplazar una instantánea ilegible con una escritura ordinaria.
      this.snapshot(db, location);
      ensureSemanticRecovery(location, guard);
      // Los originales en cuarentena sólo se conservan hasta la siguiente edición explícita.
      forgetDamagedSemanticCopies(location, guard);
      const payload = safeStorage.encryptString(JSON.stringify({ scope: location, snapshot }));
      if (payload.byteLength > 12 * 1024 * 1024) throw new Error();
      db.exec('BEGIN IMMEDIATE');
      try { guard(); db.prepare('INSERT OR REPLACE INTO snapshot VALUES(1,?)').run(payload); guard(); db.exec('COMMIT'); }
      catch (error) { db.exec('ROLLBACK'); throw error; }
    });
  }
}
