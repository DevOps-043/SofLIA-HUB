import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { safeStorage } from 'electron';
import { BrowserSyncCrypto, type BrowserSyncEnvelope, type BrowserSyncPayload } from '../integrated-browser/sync-crypto';
import { BrowserSyncClient } from '../integrated-browser/sync-client';
import { BrowserSyncCheckpointStore } from '../integrated-browser/sync-checkpoint-store';
import { BrowserSyncConflictStore } from '../integrated-browser/sync-conflict-store';
import { BrowserSyncSettingsStore } from '../integrated-browser/sync-settings-store';
import type { BrowserSyncCategory } from '../integrated-browser/platform-types';

let root: string;
const binding = { ownerId: '11111111-1111-4111-8111-111111111111', origin: 'https://fixture.supabase.co' };
const guard = () => undefined;
beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'pulse-sync-client-'));
  vi.mocked(safeStorage.isEncryptionAvailable).mockReturnValue(true);
  vi.mocked(safeStorage.encryptString).mockImplementation((text) => Buffer.from(Buffer.from(text).map((byte) => byte ^ 97)));
  vi.mocked(safeStorage.decryptString).mockImplementation((bytes) => Buffer.from(Buffer.from(bytes).map((byte) => byte ^ 97)).toString('utf8'));
});
afterEach(async () => { vi.restoreAllMocks(); await fs.rm(root, { recursive: true, force: true }); });

async function fixture() {
  const crypto = new BrowserSyncCrypto(path.join(root, 'sync-key.json')); await crypto.initialize();
  const checkpoints = new BrowserSyncCheckpointStore(path.join(root, 'sync-checkpoints.json'));
  const conflicts = new BrowserSyncConflictStore(path.join(root, 'sync-conflicts.json'));
  let data: BrowserSyncPayload = { tabLayout: 'horizontal' };
  let cloud: { revision: number; envelope: BrowserSyncEnvelope } | null = null;
  const receipts = new Map<string, number>();
  const local = { read: vi.fn(async () => structuredClone(data)), compareAndApply: vi.fn(async (_category: BrowserSyncCategory, _before: BrowserSyncPayload, next: BrowserSyncPayload, check: () => void) => { check(); data = structuredClone(next); return true; }) };
  const remote = { active: vi.fn(async () => true), read: vi.fn(async () => cloud), put: vi.fn(async (envelope: BrowserSyncEnvelope, revision: number, key: string) => {
    if (receipts.has(key)) return { status: 'replayed' as const, revision: receipts.get(key)! };
    if ((cloud?.revision ?? 0) !== revision) return { status: 'conflict' as const, revision: cloud?.revision ?? 0 };
    cloud = { revision: revision + 1, envelope }; receipts.set(key, cloud.revision); return { status: 'written' as const, revision: cloud.revision };
  }) };
  const client = () => new BrowserSyncClient({ checkpoints, crypto, conflicts, local });
  const run = (extra: Partial<Parameters<BrowserSyncClient['synchronize']>[0]> = {}) => client().synchronize({ categories: ['settings'], binding, signal: new AbortController().signal, guard, remote, ...extra });
  return { crypto, checkpoints, conflicts, local, remote, run, setLocal: (next: BrowserSyncPayload) => { data = next; }, setCloud: async (next: BrowserSyncPayload, revision: number) => { cloud = { revision, envelope: await crypto.encrypt({ category: 'settings', payload: next }) }; } };
}
describe('Cliente sync con checkpoint durable', () => {
  it('conserva la elección nueva si otro equipo publica durante la recuperación de un commit incierto', async () => {
    const f = await fixture(); f.setLocal({ theme: 'system', tabLayout: 'horizontal' }); await f.run();
    f.setLocal({ theme: 'light', tabLayout: 'horizontal' }); await f.setCloud({ theme: 'dark', tabLayout: 'horizontal' }, 2);
    const conflict = await f.run(); const put = f.remote.put.getMockImplementation()!;
    f.remote.put.mockImplementationOnce(async (...args) => { await put(...args); throw new Error('Respuesta perdida'); });
    await expect(f.run({ conflictResolution: { [conflict.conflicts[0].reviewId]: 'local' } })).rejects.toThrow('Respuesta perdida');
    f.setLocal({ theme: 'light', tabLayout: 'vertical' });
    expect((await f.run()).state).toBe('local-changed');
    f.remote.put.mockImplementation(async (...args) => {
      if (args[1] === 3) await f.setCloud({ theme: 'dark', tabLayout: 'horizontal' }, 4);
      return put(...args);
    });
    await f.run({ initialResolution: { settings: 'local' } });
    const next = await f.run(); expect(next.state).toBe('idle');
    expect((await f.checkpoints.read(binding)).categories.settings?.base).toEqual({ theme: 'dark', tabLayout: 'vertical' });
    expect(await f.conflicts.list()).toEqual([]);
  });
  it('vuelve a revisar una edición local durante un conflicto sin aceptar la elección obsoleta', async () => {
    const f = await fixture(); f.setLocal({ theme: 'system' }); await f.run();
    f.setLocal({ theme: 'light' }); await f.setCloud({ theme: 'dark' }, 2);
    const first = await f.run(); expect(first.state).toBe('conflict');
    const oldId = first.conflicts[0].reviewId; f.setLocal({ theme: 'light', tabLayout: 'vertical' });
    const refreshed = await f.run({ conflictResolution: { [oldId]: 'remote' } });
    expect(refreshed.state).toBe('conflict'); expect(refreshed.conflicts[0].reviewId).not.toBe(oldId);
    expect(f.remote.put).toHaveBeenCalledTimes(1);
    const result = await f.run({ conflictResolution: { [refreshed.conflicts[0].reviewId]: 'remote' } });
    expect(result.state).toBe('idle'); expect((await f.checkpoints.read(binding)).categories.settings?.base).toEqual({ theme: 'dark', tabLayout: 'vertical' });
    expect(await f.conflicts.list()).toEqual([]);
  });
  it('publica, conserva base cifrada y no vuelve a escribir cuando no cambió nada', async () => {
    const f = await fixture(); expect((await f.run()).state).toBe('idle');
    expect((await f.checkpoints.read(binding)).categories.settings?.revision).toBe(1);
    expect(await fs.readFile(path.join(root, 'sync-checkpoints.json'), 'utf8')).not.toContain('horizontal');
    await f.run(); expect(f.remote.put).toHaveBeenCalledTimes(1);
  });
  it('reabre y repite el mismo envelope/idempotencia si se perdió la respuesta', async () => {
    const f = await fixture(); const put = f.remote.put.getMockImplementation()!;
    f.remote.put.mockImplementationOnce(async (...args) => { await put(...args); throw new Error('Respuesta perdida'); });
    await expect(f.run()).rejects.toThrow('Respuesta perdida');
    const original = f.remote.put.mock.calls[0];
    expect((await f.run()).state).toBe('idle'); expect(f.remote.put.mock.calls[1].slice(0, 4)).toEqual(original.slice(0, 4));
    expect((await f.checkpoints.read(binding)).categories.settings?.pending).toBeUndefined();
  });
  it('no inventa base inicial y exige revisar otra vez si cambió el remoto', async () => {
    const f = await fixture(); await f.setCloud({ tabLayout: 'vertical' }, 2);
    expect((await f.run()).state).toBe('initial-review'); expect(f.remote.put).not.toHaveBeenCalled();
    await f.setCloud({ tabLayout: 'horizontal' }, 3);
    expect((await f.run({ initialResolution: { settings: 'remote' } })).state).toBe('initial-review'); expect(f.remote.put).not.toHaveBeenCalled();
    expect((await f.run({ initialResolution: { settings: 'remote' } })).state).toBe('idle');
  });
  it('no pisa una edición local posterior a una escritura remota incierta', async () => {
    const f = await fixture(); const put = f.remote.put.getMockImplementation()!;
    f.remote.put.mockImplementationOnce(async (...args) => { await put(...args); throw new Error('Respuesta perdida'); });
    await expect(f.run()).rejects.toThrow(); f.setLocal({ tabLayout: 'vertical' });
    expect((await f.run()).state).toBe('local-changed'); expect(f.local.compareAndApply).not.toHaveBeenCalled();
    expect((await f.checkpoints.read(binding)).categories.settings?.pending).toBeDefined();
    expect((await f.run({ initialResolution: { settings: 'local' } })).state).toBe('idle');
    expect((await f.checkpoints.read(binding)).categories.settings?.base).toEqual({ tabLayout: 'vertical' });
  });
  it('rechaza otro titular o corrupción sin reemplazar el checkpoint', async () => {
    const f = await fixture(); await f.run(); const destination = path.join(root, 'sync-checkpoints.json');
    await expect(f.checkpoints.read({ ...binding, ownerId: '22222222-2222-4222-8222-222222222222' })).rejects.toThrow('punto');
    await fs.writeFile(destination, 'corrupto'); await expect(f.run()).rejects.toThrow('conserva'); expect(await fs.readFile(destination, 'utf8')).toBe('corrupto');
  });
  it('aborta antes de consultar o cifrar y rechaza dispositivos revocados', async () => {
    const f = await fixture(); const controller = new AbortController(); controller.abort();
    await expect(f.run({ signal: controller.signal })).rejects.toThrow('cancelada'); expect(f.remote.active).not.toHaveBeenCalled();
    f.remote.active.mockResolvedValue(false); await expect(f.run()).rejects.toThrow('autorizado'); expect(f.remote.put).not.toHaveBeenCalled();
  });
  it('reintenta la persistencia local si falló después de aplicar en memoria', async () => {
    const f = await fixture(); const apply = f.local.compareAndApply.getMockImplementation()!;
    f.local.compareAndApply.mockImplementationOnce(async (...args) => { await apply(...args); throw new Error('Disco ocupado'); });
    await expect(f.run()).rejects.toThrow('Disco ocupado'); expect((await f.run()).state).toBe('idle'); expect(f.local.compareAndApply).toHaveBeenCalledTimes(2);
  });
  it('la configuración cifrada conserva categorías y rechaza secretos/exceso', async () => {
    const store = new BrowserSyncSettingsStore(path.join(root, 'settings.json'));
    expect((await store.read()).categories).toEqual([]);
    await store.write({ version: 1, ...binding, categories: ['settings'], lastSyncedAt: null }, guard);
    expect((await store.read()).categories).toEqual(['settings']);
    expect(() => store.write({ version: 1, ...binding, categories: ['passwords' as BrowserSyncCategory], lastSyncedAt: null }, guard)).toThrow();
    await fs.writeFile(path.join(root, 'settings.json'), 'x'.repeat(8193)); await expect(store.read()).rejects.toThrow('conserva');
  });
});
