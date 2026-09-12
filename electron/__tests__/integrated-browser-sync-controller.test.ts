import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { safeStorage } from 'electron';
import { BrowserSyncController, validateSyncControlRequest, type BrowserSyncControlContext } from '../integrated-browser/sync-controller';
import { BrowserSyncCrypto } from '../integrated-browser/sync-crypto';
import type { BrowserSyncConnection } from '../integrated-browser/sync-auth';

let root: string;
beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'pulse-sync-control-'));
  vi.mocked(safeStorage.isEncryptionAvailable).mockReturnValue(true);
  vi.mocked(safeStorage.encryptString).mockImplementation((text) => Buffer.from(Buffer.from(text).map((byte) => byte ^ 42)));
  vi.mocked(safeStorage.decryptString).mockImplementation((bytes) => Buffer.from(Buffer.from(bytes).map((byte) => byte ^ 42)).toString('utf8'));
});
afterEach(async () => { vi.restoreAllMocks(); await fs.rm(root, { recursive: true, force: true }); });
function fixture() {
  const connection = { binding: { ownerId: '11111111-1111-4111-8111-111111111111', sessionId: '22222222-2222-4222-8222-222222222222', origin: 'https://fixture.supabase.co' }, remote: { active: vi.fn(async () => true), read: vi.fn(async () => null) }, dispose: vi.fn() };
  const connect = vi.fn(async () => connection as unknown as BrowserSyncConnection);
  const context: BrowserSyncControlContext = { enabled: true, authenticated: true, profileRoot: root, guard: vi.fn(),
    local: { read: vi.fn(async () => []), compareAndApply: vi.fn(async () => true) }, confirm: vi.fn(async () => true), recoveryPath: vi.fn(async () => path.join(root, 'recovery.txt')) };
  return { connection, connect, context, manager: new BrowserSyncController(connect) };
}
describe('Control de sincronización con consentimiento', () => {
  it('no permite decisiones inventadas o de otra categoría aunque ambas estén activas', async () => {
    const f = fixture(); const crypto = new BrowserSyncCrypto(path.join(root, 'sync-key.json')); await crypto.initialize();
    await f.manager.configure(['bookmarks', 'settings'], f.context);
    vi.mocked(f.context.local.read).mockImplementation(async (category) => category === 'settings' ? { tabLayout: 'horizontal' } : []);
    f.connection.remote.read.mockImplementation(async (category?: string) => ({ revision: 1, envelope: await crypto.encrypt({ category, payload: category === 'bookmarks' ? [] : { tabLayout: 'vertical' } }) }) as never);
    const result = await f.manager.synchronize(f.context); expect(result.initialCategories).toEqual(['bookmarks', 'settings']);
    const count = f.connect.mock.calls.length; vi.mocked(f.context.confirm).mockClear();
    await expect(f.manager.synchronize(f.context, { category: 'settings', choice: 'remote', reviewId: 'a'.repeat(64) })).rejects.toThrow('revisión visible');
    expect(f.connect).toHaveBeenCalledTimes(count); expect(f.context.confirm).not.toHaveBeenCalled();
  });
  it('sin flag o invitado no consulta configuración, clave ni Auth', async () => {
    const f = fixture(); f.context.enabled = false;
    expect((await f.manager.status(f.context)).enabled).toBe(false); expect(f.connect).not.toHaveBeenCalled();
    expect(await fs.readdir(root)).toEqual([]);
  });
  it('cancelar el consentimiento no crea clave ni conecta', async () => {
    const f = fixture(); vi.mocked(f.context.confirm).mockResolvedValue(false);
    expect((await f.manager.keys('export', f.context)).canceled).toBe(true); expect(f.connect).not.toHaveBeenCalled(); expect(await fs.readdir(root)).toEqual([]);
  });
  it('exporta a un archivo elegido sin clave por respuesta y conserva copia previa', async () => {
    const f = fixture(); const result = await f.manager.keys('export', f.context);
    expect(result.keyAvailable).toBe(true); expect(JSON.stringify(result)).not.toContain('SL1-');
    const code = await fs.readFile(path.join(root, 'recovery.txt'), 'utf8'); expect(code).toMatch(/^SL1-/);
    await expect(f.manager.keys('export', f.context)).rejects.toThrow('No se pudo'); expect(await fs.readFile(path.join(root, 'recovery.txt'), 'utf8')).toBe(code);
    expect(f.connection.dispose).toHaveBeenCalledTimes(1);
  });
  it('no genera otra clave cuando hay datos remotos sin clave local', async () => {
    const f = fixture(); f.connection.remote.read.mockResolvedValue({ revision: 1 } as never);
    await expect(f.manager.keys('export', f.context)).rejects.toThrow('Ya hay datos');
    expect(await fs.readdir(root)).toEqual([]); expect(f.connection.dispose).toHaveBeenCalled();
  });
  it('importa código válido y rechaza reemplazar una clave diferente', async () => {
    const source = new BrowserSyncCrypto(path.join(root, 'source-key.json')); const { recoveryCode } = await source.initialize();
    await fs.writeFile(path.join(root, 'recovery.txt'), recoveryCode!);
    const f = fixture(); expect((await f.manager.keys('import', f.context)).keyAvailable).toBe(true); expect(f.connect).not.toHaveBeenCalled();
    const other = new BrowserSyncCrypto(path.join(root, 'other-key.json')); await fs.writeFile(path.join(root, 'recovery.txt'), (await other.initialize()).recoveryCode!);
    await expect(f.manager.keys('import', f.context)).rejects.toThrow('No se pudo');
  });
  it('configura categorías con sesión activa y pausa sin borrar claves ni revocar', async () => {
    const f = fixture(); await new BrowserSyncCrypto(path.join(root, 'sync-key.json')).initialize();
    expect((await f.manager.configure(['bookmarks'], f.context)).categories).toEqual(['bookmarks']);
    expect((await f.manager.configure([], f.context)).categories).toEqual([]); expect(f.connect).toHaveBeenCalledTimes(1);
    expect((await f.manager.status(f.context)).keyAvailable).toBe(true);
  });
  it('cancelación del diálogo rechaza aprobación tardía y bloquea otro diálogo', async () => {
    const f = fixture(); let finish!: (value: boolean) => void;
    vi.mocked(f.context.confirm).mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const operation = f.manager.keys('export', f.context); const assertion = expect(operation).rejects.toThrow('cancelada');
    await vi.waitFor(() => expect(f.context.confirm).toHaveBeenCalled()); f.manager.cancel(); await assertion;
    await expect(f.manager.keys('export', f.context)).rejects.toThrow('pendiente'); finish(true); await Promise.resolve(); expect(f.connect).not.toHaveBeenCalled();
  });
  it.each([{}, { action: 'run', password: 'no' }, { action: 'configure', categories: ['cookies'] }, { action: 'resolve', category: 'tabs', choice: 'custom' }, { action: 'import-key', path: 'arbitrario' }])('rechaza payloads IPC abiertos %#', (input) => {
    expect(() => validateSyncControlRequest(input)).toThrow();
  });
});
