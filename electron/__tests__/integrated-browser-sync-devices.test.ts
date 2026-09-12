import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { safeStorage } from 'electron';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserSyncRemote, type BrowserSyncAuth, type BrowserSyncRemoteDevice } from '../integrated-browser/sync-remote';
import { BrowserSyncDeviceIdentity } from '../integrated-browser/sync-device-identity';
import { BrowserSyncDevices, type BrowserSyncDeviceContext } from '../integrated-browser/sync-devices';
import { readBrowserSyncClaims } from '../integrated-browser/sync-auth';
import type { BrowserSyncEnvelope } from '../integrated-browser/sync-crypto';

const ownerId = '11111111-1111-4111-8111-111111111111';
const sessionId = '22222222-2222-4222-8222-222222222222';
const deviceId = '33333333-3333-4333-8333-333333333333';
const auth: BrowserSyncAuth = { origin: 'https://fixture.supabase.co', apiKey: 'public-fixture', accessToken: 'token-ficticio', ownerId, sessionId };
const binding = { origin: auth.origin, ownerId, sessionId };
const roots: string[] = [];
const ok = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
const envelope: BrowserSyncEnvelope = { version: 1, algorithm: 'aes-256-gcm', category: 'bookmarks', nonce: Buffer.alloc(12).toString('base64'), authTag: Buffer.alloc(16).toString('base64'), ciphertext: Buffer.from('cifrado-fixture').toString('base64') };
const guard = () => undefined;
beforeEach(() => { vi.mocked(safeStorage.isEncryptionAvailable).mockReturnValue(true); });
afterEach(async () => { vi.useRealTimers(); vi.restoreAllMocks(); await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true }))); });
async function fixture() { const root = await fs.mkdtemp(path.join(os.tmpdir(), 'soflia-sync-devices-')); roots.push(root); return root; }

describe('Transporte sync cerrado y cancelable', () => {
  it('verifica Auth antes de usar la identidad y rechaza usuario anónimo/ajeno', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(ok({ id: ownerId, is_anonymous: false })).mockResolvedValueOnce(ok({ id: ownerId, is_anonymous: true })).mockResolvedValueOnce(ok({ id: deviceId, is_anonymous: false }));
    const remote = new BrowserSyncRemote(auth, guard, fetcher);
    const signal = new AbortController().signal;
    await remote.verify(signal);
    await expect(remote.verify(signal)).rejects.toThrow('verificada');
    await expect(remote.verify(signal)).rejects.toThrow('verificada');
    expect(fetcher).toHaveBeenCalledWith(`${auth.origin}/auth/v1/user`, expect.objectContaining({ credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer' }));
  });
  it.each(['http://fixture.supabase.co', 'https://local.test', 'https://fixture.supabase.co/otra', 'https://user:secret@fixture.supabase.co', 'https://fixture.supabase.co?secreto=x'])('rechaza endpoint no autorizado %#', (origin) => {
    expect(() => new BrowserSyncRemote({ ...auth, origin }, guard)).toThrow('configurado');
  });
  it('reintenta escrituras con cuerpo e idempotencia idénticos, sin recifrar', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(ok({}, 503)).mockResolvedValueOnce(ok({}, 429)).mockResolvedValueOnce(ok({ status: 'replayed', revision: 3 }));
    const remote = new BrowserSyncRemote(auth, guard, fetcher);
    const pending = remote.put(envelope, 2, deviceId, sessionId, new AbortController().signal);
    await vi.runAllTimersAsync();
    expect(await pending).toEqual({ status: 'replayed', revision: 3 });
    const bodies = fetcher.mock.calls.map((call) => call[1]?.body);
    expect(new Set(bodies).size).toBe(1);
    expect(JSON.parse(String(bodies[0]))).toMatchObject({ p_idempotency_key: deviceId, p_trace_id: sessionId, p_expected_revision: 2 });
  });
  it('no reintenta permisos denegados ni devuelve el cuerpo del error', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(ok({ message: 'ruta token secreto' }, 403));
    await expect(new BrowserSyncRemote(auth, guard, fetcher).active(new AbortController().signal)).rejects.toThrow('autorizados');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('cancela fetch pendiente y también la espera entre reintentos', async () => {
    const cancel = new AbortController();
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => new Promise(() => undefined));
    const pending = new BrowserSyncRemote(auth, guard, fetcher).active(cancel.signal);
    const assertion = expect(pending).rejects.toThrow('cancelada');
    cancel.abort(); await assertion;
    expect(fetcher.mock.calls[0][1]?.signal?.aborted).toBe(true);
    const second = new AbortController();
    const retry = vi.fn<typeof fetch>().mockResolvedValue(ok({}, 503));
    const waiting = new BrowserSyncRemote(auth, guard, retry).active(second.signal);
    const rejected = expect(waiting).rejects.toThrow('cancelada');
    await Promise.resolve(); second.abort(); await rejected;
    expect(retry).toHaveBeenCalledTimes(1);
  });
  it('acota el cuerpo y el tiempo incluso si el cuerpo no termina', async () => {
    const oversized = vi.fn<typeof fetch>().mockResolvedValue(ok('x'.repeat(5000)));
    await expect(new BrowserSyncRemote(auth, guard, oversized).active(new AbortController().signal)).rejects.toThrow('cuota');
    vi.useFakeTimers();
    const stalled = vi.fn<typeof fetch>().mockResolvedValue(new Response(new ReadableStream(), { headers: { 'Content-Type': 'application/json' } }));
    const pending = new BrowserSyncRemote(auth, guard, stalled).active(new AbortController().signal);
    const assertion = expect(pending).rejects.toThrow('cancelada');
    await vi.advanceTimersByTimeAsync(20_000); await assertion;
  });
  it('valida listas, categorías y recibos sin exponer campos ajenos', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(ok([{ device_id: deviceId, created_at: '2026-09-08T00:00:00Z', revoked_at: null }]))
      .mockResolvedValueOnce(ok([{ device_id: deviceId, created_at: '2026-09-08T00:00:00Z', revoked_at: null, owner_user_id: ownerId }]))
      .mockResolvedValueOnce(ok([{ revision: 2, envelope: { ...envelope, category: 'settings' } }]))
      .mockResolvedValueOnce(ok({ status: 'written', revision: 88 }));
    const remote = new BrowserSyncRemote(auth, guard, fetcher), signal = new AbortController().signal;
    expect(await remote.devices(signal)).toEqual([{ id: deviceId, createdAt: '2026-09-08T00:00:00Z', revokedAt: null }]);
    await expect(remote.devices(signal)).rejects.toThrow('contrato');
    await expect(remote.read('bookmarks', signal)).rejects.toThrow('categoría');
    await expect(remote.put(envelope, 1, deviceId, sessionId, signal)).rejects.toThrow('recibo');
    await expect(remote.put({ ...envelope, password: 'prohibido' } as never, 1, deviceId, sessionId, signal)).rejects.toThrow('inválido');
  });
  it('rechaza respuestas tardías de otro contexto sin iniciar otra llamada', async () => {
    let valid = true;
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => { valid = false; return ok(true); });
    await expect(new BrowserSyncRemote(auth, () => { if (!valid) throw new Error('Contexto obsoleto'); }, fetcher).active(new AbortController().signal)).rejects.toThrow('obsoleto');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

describe('Identidad local aleatoria y cifrada', () => {
  it('reutiliza ID entre instancias/reintentos y cambia al iniciar otra sesión', async () => {
    const root = await fixture(), file = path.join(root, 'sync-device.json');
    const a = new BrowserSyncDeviceIdentity(file), b = new BrowserSyncDeviceIdentity(file);
    const [first, second] = await Promise.all([a.ensure(binding, guard), b.ensure(binding, guard)]);
    expect(first).toBe(second);
    expect(await b.get(binding)).toBe(first);
    const text = await fs.readFile(file, 'utf8');
    expect(text).not.toContain(ownerId); expect(text).not.toContain(sessionId); expect(text).not.toContain(first);
    expect(await a.ensure({ ...binding, sessionId: deviceId }, guard)).not.toBe(first);
  });
  it('corrupción y fallo de reemplazo no borran la identidad previa', async () => {
    const root = await fixture(), file = path.join(root, 'sync-device.json');
    const identity = new BrowserSyncDeviceIdentity(file);
    await identity.ensure(binding, guard);
    const original = await fs.readFile(file, 'utf8');
    vi.spyOn(fs, 'rename').mockRejectedValueOnce(new Error('EACCES secreto'));
    await expect(identity.ensure({ ...binding, sessionId: deviceId }, guard)).rejects.toThrow('Se conserva');
    expect(await fs.readFile(file, 'utf8')).toBe(original);
    await fs.writeFile(file, 'inválido');
    await expect(identity.ensure(binding, guard)).rejects.toThrow('Se conserva');
    expect(await fs.readFile(file, 'utf8')).toBe('inválido');
  });
});

describe('Gestión de dispositivos con consentimiento', () => {
  async function managerFixture() {
    let active = false, currentId = deviceId;
    const remote = {
      active: vi.fn(async () => active), devices: vi.fn(async (): Promise<BrowserSyncRemoteDevice[]> => [{ id: currentId, createdAt: '2026-09-08T00:00:00Z', revokedAt: null }]),
      register: vi.fn(async (id: string) => { active = true; currentId = id; }), revoke: vi.fn(async () => { active = false; }),
    };
    const dispose = vi.fn();
    const connect = vi.fn(async () => ({ binding, remote: remote as unknown as BrowserSyncRemote, dispose }));
    const context: BrowserSyncDeviceContext = { enabled: true, authenticated: true, profileRoot: await fixture(), guard, confirm: vi.fn(async () => true) };
    return { remote, dispose, connect, context, manager: new BrowserSyncDevices(connect) };
  }
  it('no toca red ni archivos con flag apagado o perfil efímero', async () => {
    const { manager, connect, context } = await managerFixture();
    expect((await manager.status({ ...context, enabled: false })).state).toBe('disabled');
    expect((await manager.status({ ...context, authenticated: false })).state).toBe('disabled');
    await expect(manager.register({ ...context, enabled: false })).rejects.toThrow('habilitada');
    expect(connect).not.toHaveBeenCalled();
    expect(await fs.readdir(context.profileRoot)).toEqual([]);
  });
  it('cancelar confirmación no registra ni persiste; aceptar y revocar requiere otra confirmación', async () => {
    const { manager, remote, context, dispose } = await managerFixture();
    vi.mocked(context.confirm).mockResolvedValueOnce(false);
    expect((await manager.register(context)).canceled).toBe(true);
    expect(remote.register).not.toHaveBeenCalled();
    expect(await fs.readdir(context.profileRoot)).toEqual([]);
    const status = await manager.register(context);
    expect(status.state).toBe('registered'); expect(status.devices[0]).toMatchObject({ current: true, label: 'Este dispositivo' });
    expect((await manager.revoke(status.devices[0].id, context)).state).toBe('inactive');
    expect(context.confirm).toHaveBeenCalledTimes(3); expect(dispose).toHaveBeenCalledTimes(3);
  });
  it('no acepta un dispositivo ajeno a la lista', async () => {
    const { manager, remote, context } = await managerFixture();
    await expect(manager.revoke(ownerId, context)).rejects.toThrow('disponible');
    expect(context.confirm).not.toHaveBeenCalled(); expect(remote.revoke).not.toHaveBeenCalled();
  });
  it.each(['vacía', 'todos revocados', 'registro local ausente', 'registro local revocado'] as const)('no publica registro activo si cambia la lista después de active(): %s', async (scenario) => {
    const { manager, remote, context } = await managerFixture();
    const status = await manager.register(context);
    const current = status.devices[0];
    const other = { id: ownerId, createdAt: '2026-09-08T00:00:00Z', revokedAt: null };
    const revoked = { ...current, revokedAt: '2026-09-08T01:00:00Z' };
    const rows = scenario === 'vacía' ? [] : scenario === 'todos revocados' ? [revoked]
      : scenario === 'registro local ausente' ? [other] : [revoked, other];
    remote.devices.mockResolvedValueOnce(rows);
    await expect(manager.status(context)).rejects.toThrow('El registro activo cambió');
    expect(context.confirm).toHaveBeenCalledTimes(1);
    expect(remote.register).toHaveBeenCalledTimes(1);
    // El siguiente intento consulta active() de nuevo; no reactiva la sesión.
    remote.active.mockResolvedValueOnce(false);
    expect((await manager.status(context)).state).toBe('inactive');
    expect(remote.register).toHaveBeenCalledTimes(1);
  });
  it('cancelar una confirmación pendiente impide que su aceptación tardía registre', async () => {
    const { manager, remote, context } = await managerFixture();
    let answer!: (value: boolean) => void;
    vi.mocked(context.confirm).mockImplementationOnce(() => new Promise((resolve) => { answer = resolve; }));
    const pending = manager.register(context);
    await vi.waitFor(() => expect(context.confirm).toHaveBeenCalled());
    const assertion = expect(pending).rejects.toThrow('cancelada');
    manager.cancel(); await assertion;
    await expect(manager.register(context)).rejects.toThrow('confirmación');
    answer(true); await Promise.resolve();
    expect(remote.register).not.toHaveBeenCalled();
  });
});

describe('Vinculación de sesión previa a Auth', () => {
  const token = (extra: object = {}) => `e30.${Buffer.from(JSON.stringify({ sub: ownerId, session_id: sessionId, iss: `${auth.origin}/auth/v1`, role: 'authenticated', is_anonymous: false, exp: Math.floor(Date.now() / 1000) + 300, ...extra })).toString('base64url')}.firma-ficticia`;
  it('acepta forma esperada sin confundirla con firma verificada', () => {
    expect(readBrowserSyncClaims(token(), auth.origin)).toEqual({ ownerId, sessionId });
  });
  it.each([{ role: 'service_role' }, { is_anonymous: true }, { exp: 0 }, { iss: 'https://otra.example/auth/v1' }, { session_id: 'inválido' }])('rechaza sesión inválida %#', (extra) => {
    expect(() => readBrowserSyncClaims(token(extra), auth.origin)).toThrow('sesión');
  });
});
