import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { safeStorage } from 'electron';

const LIMIT = 8 * 1024 * 1024;
const queues = new Map<string, Promise<unknown>>();
export type PolicyRecoveryReview = { count: number; commit: () => Promise<void> };
export type PolicyFileCodec = { decode: (content: Buffer) => unknown; encode: (value: unknown) => Buffer };
const jsonCodec: PolicyFileCodec = { decode: content => JSON.parse(content.toString('utf8')), encode: value => Buffer.from(JSON.stringify(value)) };
class PolicyFormatError extends Error {}
class PolicyVersionError extends Error {}
/** Versión, ámbito o cuota incompatibles: nunca reinterpretar como corrupción recuperable. */
export class PolicyRecoveryUnsupportedError extends Error {}
const failure = () => new Error('No se pudo recuperar el almacén. Comprueba que exista una copia compatible y que el archivo principal esté ausente o dañado.');

/** Exclusión por archivo entre instancias de main; no es un bloqueo multiproceso. */
export async function serializePolicyFile<T>(file: string, operation: () => Promise<T>): Promise<T> {
  const key = path.resolve(file); const previous = queues.get(key) ?? Promise.resolve();
  const pending = previous.catch(() => {}).then(operation); queues.set(key, pending);
  try { return await pending; } finally { if (queues.get(key) === pending) queues.delete(key); }
}
export function policyBackupPath(file: string): string { return `${path.resolve(file)}.recovery.bin`; }
export async function flushPolicyFile(file: string): Promise<void> { await queues.get(path.resolve(file))?.catch(() => {}); }
function secure(): void {
  if (!safeStorage.isEncryptionAvailable() || (process.platform === 'linux' && safeStorage.getSelectedStorageBackend() === 'basic_text')) throw failure();
}
async function bytes(file: string, limit = LIMIT): Promise<Buffer | null> {
  let handle: Awaited<ReturnType<typeof fs.open>> | undefined;
  try {
    const stat = await fs.lstat(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > limit) throw failure();
    handle = await fs.open(file, 'r'); const opened = await handle.stat();
    if (!opened.isFile() || opened.ino !== stat.ino || opened.size > limit) throw failure();
    const chunks: Buffer[] = []; let total = 0;
    for (;;) {
      const buffer = Buffer.alloc(Math.min(64 * 1024, limit + 1 - total));
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, null);
      if (!bytesRead) break; total += bytesRead;
      if (total > limit) throw failure(); chunks.push(buffer.subarray(0, bytesRead));
    }
    return Buffer.concat(chunks);
  } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw failure(); }
  finally { await handle?.close(); }
}
function parse<T>(content: Buffer, validate: (raw: unknown) => T, codec = jsonCodec): T {
  let raw: unknown;
  try { raw = codec.decode(content); } catch (error) { if (error instanceof PolicyRecoveryUnsupportedError) throw error; throw new PolicyFormatError(); }
  if (raw && typeof raw === 'object' && 'version' in raw && (raw as { version: unknown }).version !== 1) throw new PolicyVersionError();
  try { return validate(raw); } catch (error) { if (error instanceof PolicyRecoveryUnsupportedError) throw error; throw new PolicyFormatError(); }
}
function encode(file: string, content: Buffer): Buffer {
  secure();
  const result = safeStorage.encryptString(JSON.stringify({ version: 1, scope: path.resolve(file), data: content.toString('base64') }));
  if (result.length > LIMIT * 2) throw failure(); return result;
}
function decode(file: string, content: Buffer): Buffer {
  secure();
  const value = JSON.parse(safeStorage.decryptString(content));
  if (!value || Object.keys(value).sort().join(',') !== 'data,scope,version' || value.version !== 1
    || value.scope !== path.resolve(file) || typeof value.data !== 'string') throw failure();
  const result = Buffer.from(value.data, 'base64');
  if (result.length > LIMIT || result.toString('base64') !== value.data) throw failure(); return result;
}
async function atomic(file: string, content: Buffer, guard: () => void, exclusive = false): Promise<void> {
  const temporary = `${file}.${randomUUID()}.tmp`;
  let published = false;
  try {
    guard(); const handle = await fs.open(temporary, 'wx', 0o600);
    try { await handle.writeFile(content); await handle.sync(); } finally { await handle.close(); }
    guard();
    if (exclusive) await fs.link(temporary, file); else await fs.rename(temporary, file);
    published = true;
  } finally { await fs.unlink(temporary).catch(error => {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
    if (!published) throw error;
    // La publicación ya terminó: no presentar un falso fallo que invite a repetirla.
    console.warn('[Navegador][Recuperación] Se guardó el archivo, pero quedó un temporal pendiente de limpieza.');
  }); }
}
function same(a: Buffer | null, b: Buffer | null): boolean { return a === null ? b === null : b !== null && a.equals(b); }

/** Mantiene formato principal v1; sólo copias de recuperación usan protección del SO. */
export async function readPolicyFile<T>(file: string, validate: (raw: unknown) => T, empty: () => T, codec = jsonCodec): Promise<T> {
  const content = await bytes(file);
  if (content !== null) return parse(content, validate, codec);
  if (await bytes(policyBackupPath(file), LIMIT * 2)) throw failure();
  return empty();
}

/** Debe ejecutarse bajo serializePolicyFile, junto con la lectura y mutación del consumidor. */
export async function writePolicyFile<T>(file: string, next: T, validate: (raw: unknown) => T, guard: () => void = () => {}, eraseCopies = false, codec = jsonCodec): Promise<void> {
  const content = codec.encode(validate(next));
  if (content.length > LIMIT) throw failure();
  guard(); const original = await bytes(file);
  if (original) parse(original, validate, codec);
  else if (await bytes(policyBackupPath(file), LIMIT * 2)) throw failure();
  await fs.mkdir(path.dirname(file), { recursive: true }); guard();
  if (eraseCopies) {
    // Restablecer permisos no deja la lista de orígenes retirada en las copias.
    await removePolicyCopies(file, guard);
  } else if (original) {
    const backup = encode(file, original);
    await atomic(policyBackupPath(file), backup, guard);
  }
  if (!same(original, await bytes(file))) throw failure();
  await atomic(file, content, guard, original === null);
}
async function damagedFiles(file: string): Promise<string[]> {
  const prefix = `${path.basename(file)}.damaged-`;
  const names = await fs.readdir(path.dirname(file));
  return names.filter(name => name.startsWith(prefix) && /^[a-f0-9-]{36}\.bin$/i.test(name.slice(prefix.length)))
    .map(name => path.join(path.dirname(file), name));
}
async function removePolicyCopies(file: string, guard: () => void): Promise<void> {
  for (const target of [policyBackupPath(file), ...await damagedFiles(file)]) {
    guard(); const stat = await fs.lstat(target).catch(error => { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; });
    if (!stat) continue;
    if (!stat.isFile() || stat.isSymbolicLink()) throw failure();
    guard(); await fs.unlink(target);
  }
}
export async function preparePolicyRecovery<T>(file: string, validate: (raw: unknown) => T,
  restrict: (value: T) => { value: T; count: number }, guard: () => void, codec = jsonCodec): Promise<PolicyRecoveryReview> {
  file = path.resolve(file); guard();
  try {
    const original = await bytes(file);
    if (original !== null) {
      try { parse(original, validate, codec); throw failure(); }
      catch (error) { if (!(error instanceof PolicyFormatError)) throw failure(); }
    }
    const backup = await bytes(policyBackupPath(file), LIMIT * 2);
    if (!backup) throw failure();
    const projected = restrict(parse(decode(file, backup), validate, codec));
    const restored = codec.encode(validate(projected.value));
    if (restored.length > LIMIT) throw failure();
    const expires = Date.now() + 300_000; let consumed = false; guard();
    return { count: projected.count, commit: async () => {
      if (consumed) throw failure(); consumed = true;
      await serializePolicyFile(file, async () => {
        guard(); if (Date.now() > expires || !same(original, await bytes(file)) || !same(backup, await bytes(policyBackupPath(file), LIMIT * 2))) throw failure();
        let damaged: string | undefined; let committed = false;
        try {
          if (original) {
            if ((await damagedFiles(file)).length >= 5) throw failure();
            damaged = `${file}.damaged-${randomUUID()}.bin`;
            await atomic(damaged, encode(file, original), guard, true);
          }
          if (!same(original, await bytes(file)) || !same(backup, await bytes(policyBackupPath(file), LIMIT * 2))) throw failure();
          await atomic(file, restored, guard, original === null); committed = true;
        } finally { if (damaged && !committed) await fs.unlink(damaged).catch(() => {}); }
      });
    } };
  } catch { throw failure(); }
}
