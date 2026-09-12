import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { safeStorage } from 'electron';
import { validateSyncSettings, type BrowserSyncSettings } from './sync-settings-store';
import { validateSyncCheckpoints } from './sync-checkpoint-store';
import { validateSyncConflictJournal } from './sync-conflict-store';
import { reconcileBrowserSync } from './sync-conflicts';
import { assertSyncRecoveryAvailable, syncRecoveryMarker } from './sync-recovery-guard';
import { BrowserSyncError } from './sync-remote';

const files = ['sync-settings.json', 'sync-checkpoints.json', 'sync-conflicts.json'] as const;
type FileName = typeof files[number];
type Snapshot = Record<FileName, Buffer | null>;
const limits: Record<FileName, number> = { 'sync-settings.json': 8192, 'sync-checkpoints.json': 64 * 1024 * 1024, 'sync-conflicts.json': 40 * 1024 * 1024 };
const MAX_MARKER = 256 * 1024 * 1024;
class Incompatible extends Error {}
const fail = () => new BrowserSyncError('No se pudo recuperar el estado local de sincronización. Si quedó una operación incompleta, usa Revertir recuperación incompleta.');
function secure(): void {
  if (!safeStorage.isEncryptionAvailable() || (process.platform === 'linux' && safeStorage.getSelectedStorageBackend() === 'basic_text')) throw fail();
}
function read(file: string, limit: number): Buffer | null {
  let fd: number | undefined;
  try {
    const stat = fs.lstatSync(file); if (!stat.isFile() || stat.isSymbolicLink() || stat.size > limit) throw fail();
    fd = fs.openSync(file, 'r'); const opened = fs.fstatSync(fd); if (!opened.isFile() || opened.ino !== stat.ino || opened.size > limit) throw fail();
    const data = Buffer.alloc(opened.size + 1); let size = 0;
    while (size < data.length) { const n = fs.readSync(fd, data, size, data.length - size, null); if (!n) break; size += n; }
    if (size > opened.size) throw fail(); return data.subarray(0, size);
  } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
  finally { if (fd !== undefined) fs.closeSync(fd); }
}
function cleanup(file: string, published = false): void {
  try { fs.unlinkSync(file); } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
    if (!published) throw error;
    console.warn('[Navegador][Sync] Estado publicado; queda un temporal de limpieza.');
  }
}
function publish(file: string, data: Buffer, guard: () => void, exclusive = false): void {
  const temporary = `${file}.${randomUUID()}.tmp`; let created = false; let published = false;
  try {
    guard(); const fd = fs.openSync(temporary, 'wx', 0o600); created = true;
    try { fs.writeFileSync(fd, data); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    guard(); if (exclusive) fs.linkSync(temporary, file); else fs.renameSync(temporary, file); published = true;
  } finally { if (created) cleanup(temporary, published); }
}
const same = (a: Buffer | null, b: Buffer | null) => a === null ? b === null : b !== null && a.equals(b);
const capture = (root: string): Snapshot => Object.fromEntries(files.map(name => [name, read(path.join(root, name), limits[name])])) as Snapshot;
function matching(root: string, expected: Snapshot, alternative?: Snapshot): void {
  const actual = capture(root);
  if (files.some(name => !same(actual[name], expected[name]) && (!alternative || !same(actual[name], alternative[name])))) throw fail();
}
function version(value: unknown): void {
  if (value && typeof value === 'object' && 'version' in value && value.version !== 1) throw new Incompatible();
}
function decode(root: string, name: FileName, content: Buffer | null): Record<string, unknown> {
  if (!content) throw fail();
  const outer = JSON.parse(content.toString('utf8')); version(outer);
  if (!outer || Object.keys(outer).sort().join(',') !== 'protectedData,version' || outer.version !== 1 || typeof outer.protectedData !== 'string') throw fail();
  const data = Buffer.from(outer.protectedData, 'base64'); if (!data.length || data.toString('base64') !== outer.protectedData) throw fail();
  const plaintext = safeStorage.decryptString(data);
  if (name === 'sync-conflicts.json' && Buffer.byteLength(plaintext) > 28 * 1024 * 1024) throw new Incompatible();
  const inner = JSON.parse(plaintext); version(inner);
  const scope = name === 'sync-conflicts.json' ? JSON.stringify([path.basename(root), name]) : path.basename(root);
  if (inner && typeof inner === 'object' && 'scope' in inner && inner.scope !== scope) throw new Incompatible();
  if (!inner || typeof inner !== 'object' || Array.isArray(inner) || inner.scope !== scope) throw fail();
  if (name !== 'sync-conflicts.json' && Object.keys(inner).sort().join(',') !== (name === 'sync-settings.json' ? 'scope,settings' : 'data,scope')) throw fail();
  return inner;
}
function settings(root: string, content: Buffer | null): BrowserSyncSettings {
  const value = decode(root, 'sync-settings.json', content).settings; version(value); return validateSyncSettings(value);
}
function encoded(value: unknown): Buffer { return Buffer.from(JSON.stringify({ version: 1, protectedData: safeStorage.encryptString(JSON.stringify(value)).toString('base64') })); }
function pack(root: string, original: Snapshot, next: Snapshot): Buffer {
  const serialize = (snapshot: Snapshot) => Object.fromEntries(files.map(name => [name, snapshot[name]?.toString('base64') ?? null]));
  const data = safeStorage.encryptString(JSON.stringify({ version: 1, scope: root, original: serialize(original), next: serialize(next) }));
  if (data.length > MAX_MARKER) throw fail(); return data;
}
function unpack(root: string, data: Buffer): { original: Snapshot; next: Snapshot } {
  const value = JSON.parse(safeStorage.decryptString(data));
  if (!value || Object.keys(value).sort().join(',') !== 'next,original,scope,version' || value.version !== 1 || value.scope !== root) throw fail();
  const snapshot = (raw: Record<FileName, unknown>): Snapshot => {
    if (!raw || Object.keys(raw).sort().join(',') !== [...files].sort().join(',')) throw fail();
    return Object.fromEntries(files.map(name => {
      if (raw[name] === null) return [name, null];
      if (typeof raw[name] !== 'string') throw fail();
      const data = Buffer.from(raw[name], 'base64'); if (data.length > limits[name] || data.toString('base64') !== raw[name]) throw fail(); return [name, data];
    })) as Snapshot;
  };
  return { original: snapshot(value.original), next: snapshot(value.next) };
}
function archiveCount(root: string): number {
  return fs.readdirSync(root).filter(name => /^sync-recovery-[a-f0-9-]{36}\.bin$/i.test(name)).length;
}
function finish(root: string, marker: Buffer, guard: () => void): void {
  if (archiveCount(root) >= 5 || !same(marker, read(syncRecoveryMarker(root), MAX_MARKER))) throw fail();
  const archive = path.join(root, `sync-recovery-${randomUUID()}.bin`);
  publish(archive, marker, guard, true);
  try { guard(); if (!same(marker, read(syncRecoveryMarker(root), MAX_MARKER))) throw fail(); fs.unlinkSync(syncRecoveryMarker(root)); }
  catch (error) { cleanup(archive); throw error; }
}

/** Recuperación local de metadata derivada. Jamás restaura claves, identidad de dispositivo ni envíos aprobados. */
export function prepareSyncStateRecovery(root: string, action: 'recover-state' | 'rollback-state', guard: () => void) {
  root = path.resolve(root); secure(); guard(); const markerFile = syncRecoveryMarker(root);
  let marker = read(markerFile, MAX_MARKER); let original: Snapshot; let next: Snapshot; let result: BrowserSyncSettings;
  if (action === 'rollback-state') {
    if (!marker) throw fail();
    ({ original, next } = unpack(root, marker)); result = settings(root, original['sync-settings.json']); matching(root, original, next);
  } else {
    assertSyncRecoveryAvailable(root); original = capture(root); result = settings(root, original['sync-settings.json']);
    if (!result.ownerId || !result.origin) throw new BrowserSyncError('Configura una identidad de sincronización válida antes de recuperar su estado.');
    let damaged = false; const referenced = new Set<string>(); const reviews = new Set<string>();
    for (const name of ['sync-checkpoints.json', 'sync-conflicts.json'] as const) {
      if (original[name] === null) continue;
      try {
        const value = decode(root, name, original[name]);
        if (name === 'sync-checkpoints.json') {
          const data = value.data; version(data);
          if (data && typeof data === 'object' && (('ownerId' in data && data.ownerId !== result.ownerId) || ('origin' in data && data.origin !== result.origin))) throw new Incompatible();
          const checked = validateSyncCheckpoints(data);
          for (const entry of Object.values(checked.categories)) {
            if (entry?.review) referenced.add(entry.review.id);
            if (entry?.pending?.reviewId) referenced.add(entry.pending.reviewId);
          }
        } else for (const review of validateSyncConflictJournal(value, path.join(root, name)).reviews) reviews.add(reconcileBrowserSync(review.input, review.choices).reviewId);
      } catch (error) { if (error instanceof Incompatible) throw fail(); damaged = true; }
    }
    if ([...referenced].some(id => !reviews.has(id)) || [...reviews].some(id => !referenced.has(id))) damaged = true;
    if (!damaged) throw new BrowserSyncError('No se detectó un checkpoint o diario dañado. No se reinició la sincronización.');
    result = { ...result, categories: [], lastSyncedAt: null };
    next = {
      'sync-settings.json': encoded({ scope: path.basename(root), settings: result }),
      'sync-checkpoints.json': encoded({ scope: path.basename(root), data: { version: 1, ownerId: result.ownerId, origin: result.origin, categories: {} } }),
      'sync-conflicts.json': encoded({ version: 1, scope: JSON.stringify([path.basename(root), 'sync-conflicts.json']), reviews: [] }),
    };
  }
  if (archiveCount(root) >= 5) throw new BrowserSyncError('Se alcanzó el límite de archivos de recuperación conservados. Revisa sus copias antes de continuar.');
  const expires = Date.now() + 300_000; let used = false; guard();
  return { settings: result, commit: () => {
    guard(); if (used || Date.now() > expires) throw fail(); used = true;
    if (action === 'recover-state') {
      assertSyncRecoveryAvailable(root); matching(root, original); marker = pack(root, original, next);
      publish(markerFile, marker, guard, true);
    } else {
      if (!same(marker, read(markerFile, MAX_MARKER))) throw fail(); matching(root, original, next);
    }
    // El marcador precede todo reemplazo y se conserva ante cualquier interrupción.
    const target = action === 'recover-state' ? next : original;
    for (const name of files) {
      guard(); matching(root, original, next);
      const destination = path.join(root, name); const current = read(destination, limits[name]); const data = target[name];
      if (same(current, data)) continue;
      if (data === null) fs.unlinkSync(destination); else publish(destination, data, guard, current === null);
    }
    guard(); matching(root, target); finish(root, marker!, guard);
  } };
}
