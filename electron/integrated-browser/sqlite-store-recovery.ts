import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { safeStorage } from 'electron';

const MAX = 128 * 1024 * 1024;
const error = () => new Error('No se pudo respaldar o recuperar el almacén SQLite. Se conservan los archivos disponibles.');
export class UnsupportedSqliteRecovery extends Error {}
export class DamagedSqliteData extends Error {}
export const sqliteBackupPath = (file: string) => `${path.resolve(file)}.recovery.bin`;
export interface SqliteRecoverySchema {
  validate: (db: DatabaseSync) => number;
  restrict: (db: DatabaseSync) => void;
}
function secure(): void {
  if (!safeStorage.isEncryptionAvailable() || (process.platform === 'linux' && safeStorage.getSelectedStorageBackend() === 'basic_text')) throw error();
}
function read(file: string, max = MAX): Buffer | null {
  let fd: number | undefined;
  try {
    const stat = fs.lstatSync(file); if (!stat.isFile() || stat.isSymbolicLink() || stat.size > max) throw error();
    fd = fs.openSync(file, 'r'); const current = fs.fstatSync(fd);
    if (!current.isFile() || current.ino !== stat.ino || current.size > max) throw error();
    const data = Buffer.alloc(current.size + 1); let size = 0;
    while (size < data.length) { const n = fs.readSync(fd, data, size, data.length - size, null); if (!n) break; size += n; }
    if (size > current.size) throw error(); return data.subarray(0, size);
  } catch (cause) { if ((cause as NodeJS.ErrnoException).code === 'ENOENT') return null; throw cause; }
  finally { if (fd !== undefined) fs.closeSync(fd); }
}
function pack(file: string, data: Buffer): Buffer {
  secure(); const output = safeStorage.encryptString(JSON.stringify({ version: 1, scope: path.resolve(file), data: data.toString('base64') }));
  if (output.length > MAX * 2) throw error(); return output;
}
function unpack(file: string, data: Buffer): Buffer {
  secure(); const value = JSON.parse(safeStorage.decryptString(data));
  if (!value || Object.keys(value).sort().join(',') !== 'data,scope,version' || value.version !== 1 || value.scope !== path.resolve(file) || typeof value.data !== 'string') throw error();
  const output = Buffer.from(value.data, 'base64'); if (output.length > MAX || output.toString('base64') !== value.data) throw error(); return output;
}
function cleanup(file: string, committed = false): void {
  try { fs.unlinkSync(file); } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === 'ENOENT') return;
    if (!committed) throw cause;
    console.warn('[Navegador][SQLite] Publicación completada; queda un temporal de limpieza.');
  }
}
function publish(file: string, data: Buffer, guard: () => void, exclusive = false): void {
  const temporary = `${file}.${randomUUID()}.tmp`; let created = false; let committed = false;
  try {
    guard(); const fd = fs.openSync(temporary, 'wx', 0o600); created = true;
    try { fs.writeFileSync(fd, data); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    guard(); if (exclusive) fs.linkSync(temporary, file); else fs.renameSync(temporary, file); committed = true;
  } finally { if (created) cleanup(temporary, committed); }
}
function damaged(file: string): string[] {
  const prefix = `${path.basename(file)}.damaged-`;
  return fs.readdirSync(path.dirname(file)).filter(name => name.startsWith(prefix) && /^[a-f0-9-]{36}\.bin$/i.test(name.slice(prefix.length))).map(name => path.join(path.dirname(file), name));
}
function noSidecars(file: string): void {
  for (const suffix of ['-wal', '-shm', '-journal']) if (read(file + suffix) !== null) throw error();
}
export function assertSqlitePrincipal(file: string): void {
  let stat: fs.Stats | undefined;
  try { stat = fs.lstatSync(file); } catch (cause) { if ((cause as NodeJS.ErrnoException).code !== 'ENOENT') throw cause; }
  if (stat && (!stat.isFile() || stat.isSymbolicLink())) throw error();
  if (!stat && read(sqliteBackupPath(file), MAX * 2) !== null) throw error();
}
/** Invalidar ANTES de borrar, recortar o reducir retención; nunca dejar una copia que resucite datos retirados. */
export function eraseSqliteCopies(file: string): void {
  for (const target of [sqliteBackupPath(file), ...damaged(file)]) if (read(target, MAX * 2) !== null) cleanup(target);
}
/** VACUUM INTO captura también el WAL mediante SQLite. Una generación cada 30 s, no una copia por evento. */
export function backupSqlite(file: string, db: DatabaseSync, guard: () => void = () => {}, validate?: (db: DatabaseSync) => unknown): void {
  secure(); guard(); const backup = sqliteBackupPath(file);
  let stat: fs.Stats | undefined;
  try { stat = fs.lstatSync(backup); } catch (cause) { if ((cause as NodeJS.ErrnoException).code !== 'ENOENT') throw cause; }
  if (stat) {
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX * 2) throw error();
    if (Date.now() - stat.mtimeMs < 30_000) return;
  }
  const previous = read(backup, MAX * 2);
  if (previous !== null) {
    unpack(file, previous); // No reemplazar una copia incompatible silenciosamente.
  }
  const temporary = `${file}.${randomUUID()}.tmp`; let created = false;
  try {
    validate?.(db);
    const fd = fs.openSync(temporary, 'wx', 0o600); created = true; fs.closeSync(fd);
    db.prepare('VACUUM INTO ?').run(temporary);
    const data = read(temporary); if (!data) throw error();
    publish(backup, pack(file, data), guard, previous === null);
  } finally { if (created) cleanup(temporary); }
}
export function refreshSqliteBackup(file: string, db: DatabaseSync, validate?: (db: DatabaseSync) => unknown): void {
  // La transacción principal ya terminó: un fallo del respaldo no convierte el guardado en un falso fallo.
  try { backupSqlite(file, db, () => {}, validate); } catch { console.warn('[Navegador][SQLite] Datos guardados; no se pudo actualizar el respaldo local.'); }
}
export function sqliteDatabasePath(db: DatabaseSync): string {
  const file = db.prepare('PRAGMA database_list').all().find(row => row.name === 'main')?.file;
  if (typeof file !== 'string' || !path.isAbsolute(file)) throw error(); return file;
}
function inspect(db: DatabaseSync, schema: SqliteRecoverySchema): number {
  if (Number(db.prepare('PRAGMA user_version').get()?.user_version) !== 1) throw new UnsupportedSqliteRecovery();
  if (Number(db.prepare("SELECT COUNT(*) AS total FROM sqlite_master WHERE type IN ('trigger','view')").get()?.total)) throw new UnsupportedSqliteRecovery();
  if (db.prepare('PRAGMA quick_check').get()?.quick_check !== 'ok') throw new DamagedSqliteData();
  return schema.validate(db);
}
const same = (a: Buffer | null, b: Buffer | null) => a === null ? b === null : b !== null && a.equals(b);
/** La validación/restricción opera sobre una copia; el principal no se abre para escribir antes de HITL. */
export function prepareSqliteRecovery(file: string, schema: SqliteRecoverySchema, guard: () => void) {
  file = path.resolve(file); secure(); guard(); noSidecars(file);
  const original = read(file); const backup = read(sqliteBackupPath(file), MAX * 2); if (!backup) throw error();
  if (original !== null) {
    let db: DatabaseSync | undefined; let corrupt = false;
    try { db = new DatabaseSync(file, { readOnly: true }); inspect(db, schema); }
    catch (cause) {
      const code = Number((cause as { errcode?: number }).errcode) & 255;
      if (cause instanceof DamagedSqliteData || code === 11 || code === 26) corrupt = true; else throw error();
    } finally { db?.close(); }
    if (!corrupt) throw error();
  }
  const project = () => {
    const temporary = `${file}.${randomUUID()}.tmp`; let created = false; let db: DatabaseSync | undefined;
    try {
      const fd = fs.openSync(temporary, 'wx', 0o600); created = true;
      try { fs.writeFileSync(fd, unpack(file, backup)); } finally { fs.closeSync(fd); }
      db = new DatabaseSync(temporary); inspect(db, schema);
      db.exec('PRAGMA journal_mode=DELETE; PRAGMA secure_delete=ON;'); schema.restrict(db); const count = inspect(db, schema);
      db.exec('VACUUM'); db.close(); db = undefined; return { count, data: read(temporary)! };
    } finally { db?.close(); if (created) cleanup(temporary); }
  };
  let projected = project();
  const expires = Date.now() + 300_000; let used = false; guard();
  return { get count() { return projected.count; }, commit: () => {
    guard(); if (used || Date.now() > expires) throw error(); used = true; noSidecars(file);
    if (!same(original, read(file)) || !same(backup, read(sqliteBackupPath(file), MAX * 2))) throw error();
    // La retención puede vencer durante el diálogo; aplicar otra vez antes de publicar.
    projected = project(); guard();
    let quarantine: string | undefined; let committed = false;
    try {
      if (original !== null) {
        if (damaged(file).length >= 5) throw error();
        quarantine = `${file}.damaged-${randomUUID()}.bin`; publish(quarantine, pack(file, original), guard, true);
      }
      guard(); noSidecars(file);
      if (!same(original, read(file)) || !same(backup, read(sqliteBackupPath(file), MAX * 2))) throw error();
      publish(file, projected.data, guard, original === null); committed = true;
    } finally { if (quarantine && !committed) cleanup(quarantine); }
  } };
}
