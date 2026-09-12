import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { safeStorage } from 'electron';

const LIMIT = 16 * 1024 * 1024;
const fail = () => new Error('No se pudo recuperar la memoria local. Se conservan los archivos disponibles.');
export class UnsupportedSemanticRecovery extends Error {}
export class DamagedSemanticSnapshot extends Error {}
export const semanticRecoveryPath = (file: string) => `${file}.recovery.bin`;
function secure(): void {
  if (!safeStorage.isEncryptionAvailable() || (process.platform === 'linux' && safeStorage.getSelectedStorageBackend() === 'basic_text')) throw fail();
}
function bytes(file: string, limit = LIMIT): Buffer | null {
  let descriptor: number | undefined;
  try {
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > limit) throw fail();
    descriptor = fs.openSync(file, 'r'); const opened = fs.fstatSync(descriptor);
    if (!opened.isFile() || opened.ino !== stat.ino || opened.size > limit) throw fail();
    const buffer = Buffer.alloc(opened.size + 1); let size = 0;
    while (size < buffer.length) { const read = fs.readSync(descriptor, buffer, size, buffer.length - size, null); if (!read) break; size += read; }
    if (size > opened.size) throw fail();
    return buffer.subarray(0, size);
  } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
  finally { if (descriptor !== undefined) fs.closeSync(descriptor); }
}
function same(left: Buffer | null, right: Buffer | null): boolean { return left === null ? right === null : right !== null && left.equals(right); }
function protect(file: string, data: Buffer): Buffer {
  secure(); const result = safeStorage.encryptString(JSON.stringify({ version: 1, scope: path.resolve(file), data: data.toString('base64') }));
  if (result.length > LIMIT * 2) throw fail(); return result;
}
function unprotect(file: string, data: Buffer): Buffer {
  secure(); const value = JSON.parse(safeStorage.decryptString(data));
  if (!value || Object.keys(value).sort().join(',') !== 'data,scope,version' || value.version !== 1 || value.scope !== path.resolve(file) || typeof value.data !== 'string') throw fail();
  const result = Buffer.from(value.data, 'base64');
  if (result.length > LIMIT || result.toString('base64') !== value.data) throw fail(); return result;
}
function atomic(file: string, data: Buffer, guard: () => void, exclusive = false): void {
  const temporary = `${file}.${randomUUID()}.tmp`; let published = false; let created = false;
  try {
    guard(); const descriptor = fs.openSync(temporary, 'wx', 0o600); created = true;
    try { fs.writeFileSync(descriptor, data); fs.fsyncSync(descriptor); } finally { fs.closeSync(descriptor); }
    guard(); if (exclusive) fs.linkSync(temporary, file); else fs.renameSync(temporary, file); published = true;
  } finally { if (created) cleanTemporary(temporary, published); }
}
function cleanTemporary(file: string, published: boolean): void {
  try { fs.unlinkSync(file); } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      if (!published) throw error;
      console.warn('[Navegador][Memoria] Recuperación publicada; queda un temporal de limpieza.');
    }
  }
}
function sidecarsAbsent(file: string): void {
  // No separar una base de su WAL o de una transacción SQLite pendiente.
  for (const suffix of ['-wal', '-shm', '-journal']) if (bytes(`${file}${suffix}`) !== null) throw fail();
}
function damagedFiles(file: string): string[] {
  const prefix = `${path.basename(file)}.damaged-`;
  return fs.readdirSync(path.dirname(file)).filter(name => name.startsWith(prefix) && /^[a-f0-9-]{36}\.bin$/i.test(name.slice(prefix.length))).map(name => path.join(path.dirname(file), name));
}
/** El índice es derivado: el respaldo contiene exclusivamente el esquema vacío, nunca fuentes ni vectores. */
export function ensureSemanticRecovery(file: string, guard: () => void): void {
  secure(); guard();
  if (bytes(semanticRecoveryPath(file), LIMIT * 2)) return;
  const temporary = `${file}.${randomUUID()}.tmp`; let db: DatabaseSync | undefined; let created = false;
  try {
    const descriptor = fs.openSync(temporary, 'wx', 0o600); created = true; fs.closeSync(descriptor);
    db = new DatabaseSync(temporary);
    db.exec('CREATE TABLE snapshot (id INTEGER PRIMARY KEY CHECK(id=1), payload BLOB NOT NULL); PRAGMA user_version=1;'); db.close(); db = undefined;
    atomic(semanticRecoveryPath(file), protect(file, bytes(temporary)!), guard, true);
  } finally { db?.close(); if (created) fs.unlinkSync(temporary); }
}
export function forgetDamagedSemanticCopies(file: string, guard: () => void): void {
  for (const damaged of damagedFiles(file)) { guard(); bytes(damaged, LIMIT * 2); fs.unlinkSync(damaged); }
}
function inspect(file: string, validate: (db: DatabaseSync) => void, empty = false): void {
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    const version = Number(db.prepare('PRAGMA user_version').get()?.user_version);
    if (version !== 1) throw new UnsupportedSemanticRecovery();
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
    if (tables.length !== 1 || tables[0].name !== 'snapshot') throw new UnsupportedSemanticRecovery();
    db.prepare('SELECT id, payload FROM snapshot LIMIT 0').all();
    if (db.prepare('PRAGMA quick_check').get()?.quick_check !== 'ok') throw new DamagedSemanticSnapshot();
    if (empty) { if (Number(db.prepare('SELECT COUNT(*) AS total FROM snapshot').get()?.total) !== 0) throw fail(); }
    else validate(db);
  } finally { db.close(); }
}
export function prepareSemanticRecovery(file: string, validate: (db: DatabaseSync) => void, guard: () => void): { count: number; commit: () => Promise<void> } {
  file = path.resolve(file); secure(); guard(); sidecarsAbsent(file);
  const original = bytes(file); const backup = bytes(semanticRecoveryPath(file), LIMIT * 2);
  if (!backup) throw fail();
  if (original !== null) {
    let damaged = false;
    try { inspect(file, validate); } catch (error) {
      const code = Number((error as { errcode?: number }).errcode) & 255;
      if (error instanceof DamagedSemanticSnapshot || code === 11 || code === 26) damaged = true;
      else throw fail();
    }
    if (!damaged) throw fail();
  }
  const restored = unprotect(file, backup);
  const probe = `${file}.${randomUUID()}.tmp`; let created = false;
  try { const descriptor = fs.openSync(probe, 'wx', 0o600); created = true; try { fs.writeFileSync(descriptor, restored); } finally { fs.closeSync(descriptor); } inspect(probe, validate, true); }
  finally { if (created) fs.unlinkSync(probe); }
  const expires = Date.now() + 300_000; let used = false; guard();
  return { count: 0, commit: async () => {
    guard(); if (used || Date.now() > expires) throw fail(); used = true; sidecarsAbsent(file);
    if (!same(original, bytes(file)) || !same(backup, bytes(semanticRecoveryPath(file), LIMIT * 2))) throw fail();
    let damaged: string | undefined; let committed = false;
    try {
      if (original !== null) {
        if (damagedFiles(file).length >= 5) throw fail();
        damaged = `${file}.damaged-${randomUUID()}.bin`; atomic(damaged, protect(file, original), guard, true);
      }
      guard(); sidecarsAbsent(file);
      if (!same(original, bytes(file)) || !same(backup, bytes(semanticRecoveryPath(file), LIMIT * 2))) throw fail();
      atomic(file, restored, guard, original === null); committed = true;
    } finally { if (damaged && !committed) fs.unlinkSync(damaged); }
  } };
}
