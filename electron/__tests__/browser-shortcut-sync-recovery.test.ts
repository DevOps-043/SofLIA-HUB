import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { safeStorage } from 'electron';
import { BrowserAgentShortcutStore } from '../integrated-browser/agent-shortcut-store';
import { BrowserSyncSettingsStore } from '../integrated-browser/sync-settings-store';
import { policyBackupPath } from '../integrated-browser/policy-file-recovery';
import { BrowserSyncController, type BrowserSyncControlContext } from '../integrated-browser/sync-controller';
const list = { action: 'list', profileRevision: 0 } as const;
const entry = { id: '', title: 'Resumen', instruction: 'Resume los fragmentos elegidos.', scope: 'selected-tabs', permission: 'read-fragments' } as const;
let root: string;
beforeEach(async () => { root = await fs.mkdtemp(path.join(os.tmpdir(), 'browser-shortcut-sync-recovery-')); vi.mocked(safeStorage.isEncryptionAvailable).mockReturnValue(true); });
afterEach(async () => { vi.restoreAllMocks(); await fs.rm(root, { recursive: true, force: true }); });
async function fixture(kind: 'shortcuts' | 'sync') {
  const file = path.join(root, kind === 'shortcuts' ? 'shortcuts.bin' : 'sync-settings.json');
  const shortcuts = new BrowserAgentShortcutStore(file); const sync = new BrowserSyncSettingsStore(file);
  if (kind === 'shortcuts') {
    const first = await shortcuts.run({ ...list, action: 'save', revision: 0, entry }, () => {});
    await shortcuts.run({ ...list, action: 'save', revision: 1, entry: { ...first.entries[0], title: 'Título nuevo' } }, () => {});
  } else {
    const settings = { version: 1 as const, ownerId: '11111111-1111-4111-8111-111111111111', origin: 'https://fixture.supabase.co', categories: ['bookmarks' as const], lastSyncedAt: null };
    await sync.write(settings, () => {}); await sync.write({ ...settings, lastSyncedAt: new Date().toISOString() }, () => {});
  }
  return { file, shortcuts, sync, store: kind === 'shortcuts' ? shortcuts : sync };
}
describe('recuperación de atajos y configuración sync', () => {
  it('restaura instrucciones con nuevos IDs/revisión y no permite editar con un recibo antiguo', async () => {
    const f = await fixture('shortcuts'); const old = await f.shortcuts.run(list, () => {});
    await fs.writeFile(f.file, 'dañado'); const backup = await fs.readFile(policyBackupPath(f.file));
    const review = await f.shortcuts.prepareRecovery(() => {}); expect(review.count).toBe(1);
    await review.commit(); const recovered = await f.shortcuts.run(list, () => {});
    expect(recovered.entries[0]).toMatchObject({ ...entry, id: expect.any(String) });
    expect(recovered.entries[0].id).not.toBe(old.entries[0].id); expect(recovered.revision).toBeGreaterThan(old.revision);
    await expect(f.shortcuts.run({ ...list, action: 'save', revision: old.revision, entry: old.entries[0] }, () => {})).rejects.toThrow('cambiaron');
    expect(await fs.readFile(policyBackupPath(f.file))).toEqual(backup);
    await f.shortcuts.run({ ...list, action: 'remove', revision: recovered.revision, id: recovered.entries[0].id }, () => {});
    expect(await fs.readdir(root)).toEqual([path.basename(f.file)]);
  });
  it('recuperar ajustes nunca reactiva categorías ni inventa una ejecución completada', async () => {
    const f = await fixture('sync'); await fs.writeFile(f.file, '{ daño');
    await (await f.sync.prepareRecovery(() => {})).commit();
    expect(await f.sync.read()).toMatchObject({ categories: [], lastSyncedAt: null, ownerId: '11111111-1111-4111-8111-111111111111' });
    await f.sync.write(await f.sync.read(), () => {});
    expect(await fs.readdir(root)).toEqual([path.basename(f.file)]);
  });
  it.each(['shortcuts', 'sync'] as const)('%s conserva principal válido, ausencia con copia y escrituras concurrentes', async kind => {
    const f = await fixture(kind); await expect(f.store.prepareRecovery(() => {})).rejects.toThrow();
    await fs.unlink(f.file);
    await expect(kind === 'shortcuts' ? f.shortcuts.run(list, () => {}) : f.sync.read()).rejects.toThrow();
    const a = await f.store.prepareRecovery(() => {}); const b = await f.store.prepareRecovery(() => {});
    const outcomes = await Promise.allSettled([a.commit(), b.commit()]);
    expect(outcomes.filter(item => item.status === 'fulfilled')).toHaveLength(1);
  });
  it.each(['futuro', 'ámbito', 'cuota'] as const)('atajos rechazan principal %s sin tratarlo como daño reemplazable', async mode => {
    const f = await fixture('shortcuts'); const parsed = JSON.parse(safeStorage.decryptString(await fs.readFile(f.file)));
    if (mode === 'futuro') parsed.version = 2;
    if (mode === 'ámbito') parsed.scope = 'otra-cuenta';
    await fs.writeFile(f.file, mode === 'cuota' ? Buffer.alloc(2 * 1024 * 1024 + 1) : safeStorage.encryptString(JSON.stringify(parsed)));
    const original = await fs.readFile(f.file); await expect(f.store.prepareRecovery(() => {})).rejects.toThrow();
    expect((await fs.readFile(f.file)).equals(original)).toBe(true);
  });
  it.each(['futuro exterior', 'futuro interior', 'ámbito', 'cuota'] as const)('sync rechaza %s conservando bytes', async mode => {
    const f = await fixture('sync'); const outer = JSON.parse(await fs.readFile(f.file, 'utf8'));
    const inner = JSON.parse(safeStorage.decryptString(Buffer.from(outer.protectedData, 'base64')));
    if (mode === 'futuro exterior') outer.version = 2;
    if (mode === 'futuro interior') inner.settings.version = 2;
    if (mode === 'ámbito') inner.scope = 'otra-cuenta';
    outer.protectedData = safeStorage.encryptString(JSON.stringify(inner)).toString('base64');
    await fs.writeFile(f.file, mode === 'cuota' ? Buffer.alloc(8193) : JSON.stringify(outer));
    const before = await fs.readFile(f.file); await expect(f.store.prepareRecovery(() => {})).rejects.toThrow(); expect(await fs.readFile(f.file)).toEqual(before);
  });
  it('guardas y flush cubren guardados asíncronos de atajos entre instancias', async () => {
    const f = await fixture('shortcuts'); const first = await f.shortcuts.run(list, () => {});
    const other = new BrowserAgentShortcutStore(f.file);
    const requests = [f.shortcuts, other].map(store => store.run({ ...list, action: 'save', revision: first.revision, entry }, () => {}));
    const outcomes = await Promise.allSettled(requests); await f.shortcuts.flush();
    expect(outcomes.filter(item => item.status === 'fulfilled')).toHaveLength(1);
    expect((await f.shortcuts.run(list, () => {})).entries).toHaveLength(2);
  });
  it.each(['confirmar', 'cancelar', 'cancelación tardía'] as const)('controlador recupera con exclusión y sin red: %s', async mode => {
    const f = await fixture('sync'); await fs.writeFile(f.file, '{ daño');
    const connect = vi.fn(); const controller = new BrowserSyncController(connect);
    let release!: (value: boolean) => void;
    const context: BrowserSyncControlContext = { enabled: true, authenticated: true, profileRoot: root, guard: vi.fn(),
      local: { read: vi.fn(), compareAndApply: vi.fn() }, recoveryPath: vi.fn(), confirm: vi.fn(() => new Promise<boolean>(resolve => { release = resolve; })) };
    const result = controller.recoverSettings(context).catch((error: Error) => error);
    await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    await expect(controller.recoverSettings(context)).rejects.toThrow('pendiente');
    if (mode === 'cancelación tardía') controller.cancel();
    release(mode !== 'cancelar'); const outcome = await result;
    expect(connect).not.toHaveBeenCalled(); expect(context.local.compareAndApply).not.toHaveBeenCalled();
    if (mode === 'confirmar') { expect(outcome).toMatchObject({ categories: [], state: 'disabled' }); expect((await f.sync.read()).categories).toEqual([]); }
    else { expect(await fs.readFile(f.file, 'utf8')).toBe('{ daño'); if (mode === 'cancelar') expect(outcome).toMatchObject({ canceled: true }); else expect(outcome).toBeInstanceOf(Error); }
  });
});
