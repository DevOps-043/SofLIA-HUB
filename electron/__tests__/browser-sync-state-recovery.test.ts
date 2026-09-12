import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { safeStorage } from 'electron';
import { BrowserSyncSettingsStore } from '../integrated-browser/sync-settings-store';
import { BrowserSyncCheckpointStore } from '../integrated-browser/sync-checkpoint-store';
import { BrowserSyncConflictStore } from '../integrated-browser/sync-conflict-store';
import { BrowserSyncCrypto } from '../integrated-browser/sync-crypto';
import { BrowserSyncClient } from '../integrated-browser/sync-client';
import { BrowserSyncController, type BrowserSyncControlContext, validateSyncControlRequest } from '../integrated-browser/sync-controller';
import { prepareSyncStateRecovery } from '../integrated-browser/sync-state-recovery';
import { assertSyncRecoveryAvailable, syncRecoveryMarker } from '../integrated-browser/sync-recovery-guard';

let root: string;
const binding = { ownerId: '11111111-1111-4111-8111-111111111111', origin: 'https://fixture.supabase.co' };
const names = ['sync-settings.json', 'sync-checkpoints.json', 'sync-conflicts.json'];
const guard = () => {};
const snapshot = () => names.map(name => fs.existsSync(path.join(root, name)) ? fs.readFileSync(path.join(root, name)).toString('base64') : null);
beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-state-recovery-')); vi.mocked(safeStorage.isEncryptionAvailable).mockReturnValue(true); });
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); fs.rmSync(root, { recursive: true, force: true }); });
async function fixture(damage = true) {
  const settings = new BrowserSyncSettingsStore(path.join(root, names[0]));
  await settings.write({ version: 1, ...binding, categories: ['settings'], lastSyncedAt: null }, guard);
  const checkpoints = new BrowserSyncCheckpointStore(path.join(root, names[1]));
  const conflicts = new BrowserSyncConflictStore(path.join(root, names[2]));
  const review = await conflicts.prepare({ category: 'settings', baseRevision: 1, remoteRevision: 2, base: { theme: 'system' }, local: { theme: 'light' }, remote: { theme: 'dark' } }, guard);
  await checkpoints.write({ version: 1, ...binding, categories: { settings: { revision: 1, base: { theme: 'system' }, review: { id: review.reviewId, local: { theme: 'light' } } } } }, guard);
  if (damage) fs.writeFileSync(path.join(root, names[1]), 'checkpoint dañado');
  return { settings, checkpoints, conflicts };
}
describe('recuperación coordinada de estado sync', () => {
  it('archiva originales y reinicia sólo metadata, pausada y sin decisiones antiguas', async () => {
    const f = await fixture(); const original = snapshot(); const key = path.join(root, 'sync-key.json'); const device = path.join(root, 'sync-device.json');
    fs.writeFileSync(key, 'clave-fixture'); fs.writeFileSync(device, 'dispositivo-fixture');
    const review = prepareSyncStateRecovery(root, 'recover-state', guard); expect(snapshot()).toEqual(original);
    review.commit(); expect((await f.settings.read()).categories).toEqual([]); expect((await f.checkpoints.read(binding)).categories).toEqual({}); expect(await f.conflicts.list()).toEqual([]);
    expect(fs.readFileSync(key, 'utf8')).toBe('clave-fixture'); expect(fs.readFileSync(device, 'utf8')).toBe('dispositivo-fixture');
    expect(() => assertSyncRecoveryAvailable(root)).not.toThrow(); expect(() => review.commit()).toThrow();
    const archive = fs.readdirSync(root).find(name => /^sync-recovery-.*\.bin$/.test(name))!;
    const content = JSON.parse(safeStorage.decryptString(fs.readFileSync(path.join(root, archive))));
    expect(names.map(name => content.original[name])).toEqual(original);
  });
  it.each([0, 1, 2])('interrupción al publicar archivo %s bloquea stores y admite rollback exacto', async index => {
    const f = await fixture(); const original = snapshot(); const rename = fs.renameSync;
    vi.spyOn(fs, 'renameSync').mockImplementation((source, destination) => { if (String(destination) === path.join(root, names[index])) throw new Error('disco'); rename(source, destination); });
    expect(() => prepareSyncStateRecovery(root, 'recover-state', guard).commit()).toThrow(); vi.restoreAllMocks();
    expect(fs.existsSync(syncRecoveryMarker(root))).toBe(true);
    await expect(f.settings.read()).rejects.toThrow(); await expect(f.checkpoints.read(binding)).rejects.toThrow(); await expect(f.conflicts.list()).rejects.toThrow();
    const restored = prepareSyncStateRecovery(root, 'rollback-state', guard); restored.commit();
    expect(snapshot()).toEqual(original); expect(() => assertSyncRecoveryAvailable(root)).not.toThrow();
  });
  it('rollback parcial puede repetirse tras reabrir sin habilitar estado mixto', async () => {
    await fixture(); const original = snapshot(); const rename = fs.renameSync;
    vi.spyOn(fs, 'renameSync').mockImplementation((source, destination) => { if (String(destination) === path.join(root, names[2])) throw new Error('disco'); rename(source, destination); });
    expect(() => prepareSyncStateRecovery(root, 'recover-state', guard).commit()).toThrow(); vi.restoreAllMocks();
    const nextRename = fs.renameSync;
    vi.spyOn(fs, 'renameSync').mockImplementation((source, destination) => { if (String(destination) === path.join(root, names[1])) throw new Error('disco'); nextRename(source, destination); });
    expect(() => prepareSyncStateRecovery(root, 'rollback-state', guard).commit()).toThrow(); vi.restoreAllMocks();
    expect(() => assertSyncRecoveryAvailable(root)).toThrow(); prepareSyncStateRecovery(root, 'rollback-state', guard).commit(); expect(snapshot()).toEqual(original);
  });
  it('una escritura externa durante la interrupción impide revertir sobre ella', async () => {
    await fixture(); vi.spyOn(fs, 'renameSync').mockImplementation(() => { throw new Error('disco'); });
    expect(() => prepareSyncStateRecovery(root, 'recover-state', guard).commit()).toThrow(); vi.restoreAllMocks();
    fs.writeFileSync(path.join(root, names[1]), 'cambio externo'); const before = snapshot();
    expect(() => prepareSyncStateRecovery(root, 'rollback-state', guard)).toThrow(); expect(snapshot()).toEqual(before); expect(fs.existsSync(syncRecoveryMarker(root))).toBe(true);
  });
  it.each(['sano', 'versión', 'ámbito', 'titular', 'configuración', 'sin cifrado', 'cuota', 'archivos'])('no prepara recuperación ante %s incompatible', async mode => {
    await fixture(false);
    if (mode === 'versión') fs.writeFileSync(path.join(root, names[1]), JSON.stringify({ version: 2, protectedData: 'AA==' }));
    if (mode === 'ámbito' || mode === 'titular') {
      const file = path.join(root, names[1]); const outer = JSON.parse(fs.readFileSync(file, 'utf8'));
      const inner = JSON.parse(safeStorage.decryptString(Buffer.from(outer.protectedData, 'base64')));
      if (mode === 'ámbito') inner.scope = 'otro'; else inner.data.ownerId = randomUUID();
      outer.protectedData = safeStorage.encryptString(JSON.stringify(inner)).toString('base64'); fs.writeFileSync(file, JSON.stringify(outer));
    }
    if (mode === 'configuración') fs.writeFileSync(path.join(root, names[0]), 'dañado');
    if (mode === 'sin cifrado') vi.mocked(safeStorage.isEncryptionAvailable).mockReturnValue(false);
    if (mode === 'cuota') { const fd = fs.openSync(path.join(root, names[1]), 'w'); fs.ftruncateSync(fd, 64 * 1024 * 1024 + 1); fs.closeSync(fd); }
    if (mode === 'archivos') { fs.writeFileSync(path.join(root, names[1]), 'dañado'); for (let i = 0; i < 5; i++) fs.writeFileSync(path.join(root, `sync-recovery-${randomUUID()}.bin`), 'archivo conservado'); }
    expect(() => prepareSyncStateRecovery(root, 'recover-state', guard)).toThrow(); expect(fs.existsSync(syncRecoveryMarker(root))).toBe(false);
  });
  it.each(['cambio', 'contexto', 'vence'])('no publica tras %s durante revisión', async mode => {
    await fixture(); const current = vi.fn(); const review = prepareSyncStateRecovery(root, 'recover-state', current);
    if (mode === 'cambio') fs.writeFileSync(path.join(root, names[1]), 'otro');
    if (mode === 'contexto') current.mockImplementation(() => { throw new Error('perfil'); });
    if (mode === 'vence') { vi.useFakeTimers(); vi.setSystemTime(Date.now() + 300001); }
    const before = snapshot(); expect(() => review.commit()).toThrow(); expect(snapshot()).toEqual(before); expect(fs.existsSync(syncRecoveryMarker(root))).toBe(false);
  });
  it('detecta diario huérfano tras perder el archivo de checkpoints', async () => {
    const f = await fixture(false); fs.unlinkSync(path.join(root, names[1]));
    prepareSyncStateRecovery(root, 'recover-state', guard).commit(); expect(await f.conflicts.list()).toEqual([]); expect((await f.checkpoints.read(binding)).categories).toEqual({});
  });
  it('una nueva pasada exige comparación remota y no reproduce envíos o elecciones anteriores', async () => {
    const f = await fixture(); const crypto = new BrowserSyncCrypto(path.join(root, 'sync-key.json')); await crypto.initialize();
    const envelope = await crypto.encrypt({ category: 'settings', payload: { theme: 'dark' } });
    prepareSyncStateRecovery(root, 'recover-state', guard).commit();
    const local = { read: vi.fn(async () => ({ theme: 'light' })), compareAndApply: vi.fn() };
    const remote = { active: vi.fn(async () => true), read: vi.fn(async () => ({ revision: 2, envelope })), put: vi.fn() };
    const client = new BrowserSyncClient({ ...f, crypto, local });
    const result = await client.synchronize({ categories: ['settings'], binding, signal: new AbortController().signal, guard, remote });
    expect(result.state).toBe('initial-review'); expect(remote.put).not.toHaveBeenCalled(); expect(local.compareAndApply).not.toHaveBeenCalled();
  });
  it.each(['confirmar', 'cancelar', 'cancelación tardía'])('controlador exige HITL, exclusión y ninguna red: %s', async mode => {
    await fixture(); const before = snapshot(); const connect = vi.fn(); const controller = new BrowserSyncController(connect);
    let release!: (value: boolean) => void;
    const context: BrowserSyncControlContext = { enabled: true, authenticated: true, profileRoot: root, guard: vi.fn(), local: { read: vi.fn(), compareAndApply: vi.fn() }, recoveryPath: vi.fn(), confirm: vi.fn(() => new Promise(resolve => { release = resolve; })) };
    const pending = controller.recoverState('recover-state', context).catch((error: Error) => error);
    await vi.waitFor(() => expect(release).toBeTypeOf('function')); await expect(controller.recoverState('recover-state', context)).rejects.toThrow('pendiente');
    if (mode === 'cancelación tardía') controller.cancel(); release(mode !== 'cancelar'); const result = await pending;
    if (mode === 'confirmar') expect(result).toMatchObject({ categories: [], state: 'disabled' });
    else { expect(snapshot()).toEqual(before); expect(fs.existsSync(syncRecoveryMarker(root))).toBe(false); }
    expect(connect).not.toHaveBeenCalled(); expect(context.local.read).not.toHaveBeenCalled(); expect(context.local.compareAndApply).not.toHaveBeenCalled();
  });
  it('rechaza parámetros que intentan autorizar, elegir archivos o falsificar acciones', () => {
    for (const raw of [{ action: 'recover-state', approved: true }, { action: 'rollback-state', path: 'archivo' }, { action: ['recover-state'] }]) expect(() => validateSyncControlRequest(raw)).toThrow();
  });
});
