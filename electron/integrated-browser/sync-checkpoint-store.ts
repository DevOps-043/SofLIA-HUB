import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { safeStorage } from 'electron';
import type { BrowserSyncCategory } from './platform-types';
import { normalizeBrowserSyncInput, validateBrowserSyncEnvelope, type BrowserSyncEnvelope, type BrowserSyncPayload } from './sync-crypto';
import { assertSyncUuid, BrowserSyncError } from './sync-remote';
import { assertSyncRecoveryAvailable } from './sync-recovery-guard';

export interface SyncCheckpoint {
  revision: number;
  base: BrowserSyncPayload;
  initial?: { revision: number; remote: BrowserSyncPayload; local: BrowserSyncPayload };
  pending?: { revision: number; envelope: BrowserSyncEnvelope; idempotencyKey: string; traceId: string; local: BrowserSyncPayload; next: BrowserSyncPayload; reviewId?: string; reviewRevision?: number; rebaseBase?: BrowserSyncPayload };
  review?: { id: string; local: BrowserSyncPayload };
}
export interface SyncCheckpoints { version: 1; ownerId: string; origin: string; categories: Partial<Record<BrowserSyncCategory, SyncCheckpoint>> }
const locks = new Map<string, Promise<unknown>>();
const maxBytes = 64 * 1024 * 1024;
function fail() { return new BrowserSyncError('No se pudo recuperar el punto de sincronización cifrado. Se conserva el archivo.'); }
function secure() { if (!safeStorage.isEncryptionAvailable() || (process.platform === 'linux' && safeStorage.getSelectedStorageBackend() === 'basic_text')) throw fail(); }
function closed(value: unknown, required: string[], optional: string[] = []): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || required.some((key) => !(key in value)) || Object.keys(value).some((key) => !required.includes(key) && !optional.includes(key))) throw fail();
}
function revision(value: unknown) { if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw fail(); }
export function validateSyncCheckpoints(raw: unknown): SyncCheckpoints {
  closed(raw, ['version', 'ownerId', 'origin', 'categories']);
  if (raw.version !== 1 || typeof raw.origin !== 'string' || !/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(raw.origin)) throw fail();
  assertSyncUuid(raw.ownerId); closed(raw.categories, [], ['bookmarks', 'groups', 'tabs', 'settings']);
  for (const [category, entry] of Object.entries(raw.categories)) {
    closed(entry, ['revision', 'base'], ['initial', 'pending', 'review']); revision(entry.revision);
    const payload = (value: unknown) => normalizeBrowserSyncInput({ category, payload: value });
    payload(entry.base);
    if (entry.initial) { closed(entry.initial, ['revision', 'remote', 'local']); revision(entry.initial.revision); payload(entry.initial.local); payload(entry.initial.remote); }
    if (entry.pending) {
      closed(entry.pending, ['revision', 'envelope', 'idempotencyKey', 'traceId', 'local', 'next'], ['reviewId', 'reviewRevision', 'rebaseBase']); revision(entry.pending.revision);
      assertSyncUuid(entry.pending.idempotencyKey); assertSyncUuid(entry.pending.traceId);
      if (validateBrowserSyncEnvelope(entry.pending.envelope).category !== category) throw fail();
      payload(entry.pending.local); payload(entry.pending.next);
      if (entry.pending.reviewId !== undefined && (typeof entry.pending.reviewId !== 'string' || !/^[a-f0-9]{64}$/.test(entry.pending.reviewId))) throw fail();
      if (entry.pending.reviewRevision !== undefined) { revision(entry.pending.reviewRevision); if (!entry.pending.reviewId || Number(entry.pending.reviewRevision) > Number(entry.pending.revision) + 1) throw fail(); }
      if (entry.pending.rebaseBase !== undefined) { if (entry.pending.reviewRevision === undefined) throw fail(); payload(entry.pending.rebaseBase); }
    }
    if (entry.review) { closed(entry.review, ['id', 'local']); if (typeof entry.review.id !== 'string' || !/^[a-f0-9]{64}$/.test(entry.review.id)) throw fail(); payload(entry.review.local); }
  }
  return structuredClone(raw) as unknown as SyncCheckpoints;
}
export class BrowserSyncCheckpointStore {
  constructor(private readonly destination: string) {}
  private lock<T>(action: () => Promise<T>) {
    const result = (locks.get(this.destination) ?? Promise.resolve()).catch(() => undefined).then(action);
    locks.set(this.destination, result);
    void result.finally(() => { if (locks.get(this.destination) === result) locks.delete(this.destination); }).catch(() => undefined);
    return result;
  }
  read(binding: { ownerId: string; origin: string }): Promise<SyncCheckpoints> {
    return this.lock(() => this.readData(binding));
  }
  private async readData(binding: { ownerId: string; origin: string }): Promise<SyncCheckpoints> {
      assertSyncRecoveryAvailable(path.dirname(this.destination));
      secure(); let file;
      try {
        const expected = await fs.lstat(this.destination);
        if (!expected.isFile() || expected.isSymbolicLink() || expected.size > maxBytes) throw fail();
        file = await fs.open(this.destination, 'r');
        const stat = await file.stat(); if (!stat.isFile() || stat.ino !== expected.ino || stat.size > maxBytes) throw fail();
        const buffer = Buffer.alloc(stat.size + 1); let size = 0;
        while (size < buffer.length) { const part = await file.read(buffer, size, buffer.length - size, null); if (!part.bytesRead) break; size += part.bytesRead; }
        if (size > stat.size) throw fail();
        const outer = JSON.parse(buffer.subarray(0, size).toString('utf8')); closed(outer, ['version', 'protectedData']);
        if (outer.version !== 1 || typeof outer.protectedData !== 'string') throw fail();
        const bytes = Buffer.from(outer.protectedData, 'base64'); if (!bytes.length || bytes.toString('base64') !== outer.protectedData) throw fail();
        const content = JSON.parse(safeStorage.decryptString(bytes)); closed(content, ['scope', 'data']);
        if (content.scope !== path.basename(path.dirname(this.destination))) throw fail();
        const data = validateSyncCheckpoints(content.data);
        if (data.ownerId !== binding.ownerId || data.origin !== binding.origin) throw fail();
        assertSyncRecoveryAvailable(path.dirname(this.destination)); return data;
      } catch (error) {
        if (!file && (error as NodeJS.ErrnoException).code === 'ENOENT') { assertSyncRecoveryAvailable(path.dirname(this.destination)); return validateSyncCheckpoints({ version: 1, ownerId: binding.ownerId, origin: binding.origin, categories: {} }); }
        throw fail();
      } finally { await file?.close(); }
  }
  write(raw: SyncCheckpoints, guard: () => void): Promise<void> {
    const data = validateSyncCheckpoints(raw);
    return this.lock(async () => {
      secure(); guard(); assertSyncRecoveryAvailable(path.dirname(this.destination));
      // No encubrir corrupción o una versión futura con una escritura normal.
      await this.readData(data); guard(); assertSyncRecoveryAvailable(path.dirname(this.destination));
      const protectedData = safeStorage.encryptString(JSON.stringify({ scope: path.basename(path.dirname(this.destination)), data })).toString('base64');
      const output = JSON.stringify({ version: 1, protectedData }); if (Buffer.byteLength(output) > maxBytes) throw fail();
      const temporary = `${this.destination}.${randomUUID()}.tmp`;
      try {
        await fs.mkdir(path.dirname(this.destination), { recursive: true });
        const file = await fs.open(temporary, 'wx', 0o600);
        try { await file.writeFile(output, 'utf8'); await file.sync(); } finally { await file.close(); }
        guard(); assertSyncRecoveryAvailable(path.dirname(this.destination)); await fs.rename(temporary, this.destination);
      } catch { throw fail(); } finally { await fs.unlink(temporary).catch(() => undefined); }
    });
  }
}
