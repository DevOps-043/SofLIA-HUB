import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WhatsAppService } from '../whatsapp/service';
import { setAuthState } from '../main/auth-state';
import { scheduleWhatsAppReconnect } from '../whatsapp/reconnect';

const mocks = vi.hoisted(() => ({ loaded: vi.fn<() => Promise<void> | undefined>(), mkdir: vi.fn(), credentials: vi.fn(), version: vi.fn(), socket: vi.fn(),
  events: { on: vi.fn() }, logout: vi.fn(), end: vi.fn() }));
vi.mock('node:fs/promises', () => ({ default: { mkdir: mocks.mkdir, readFile: vi.fn().mockRejectedValue(new Error('ENOENT')),
  writeFile: vi.fn().mockResolvedValue(undefined) } }));
vi.mock('@whiskeysockets/baileys', async () => {
  await mocks.loaded();
  return { default: mocks.socket, useMultiFileAuthState: mocks.credentials, fetchLatestBaileysVersion: mocks.version,
    makeCacheableSignalKeyStore: (keys: unknown) => keys, DisconnectReason: { loggedOut: 401 }, downloadMediaMessage: vi.fn() };
});
let services: WhatsAppService[] = [];
beforeEach(() => {
  mocks.mkdir.mockReset().mockResolvedValue(undefined);
  mocks.version.mockReset().mockResolvedValue({ version: [2, 1, 1] });
  mocks.credentials.mockReset().mockResolvedValue({ state: { creds: {}, keys: {} }, saveCreds: vi.fn() });
  mocks.logout.mockReset().mockResolvedValue(undefined);
  mocks.end.mockClear();
  mocks.socket.mockReset().mockImplementation(() => ({ ev: mocks.events, logout: mocks.logout, end: mocks.end }));
  services = [];
});
afterEach(async () => { for (const service of services) await service.disconnect().catch(() => undefined); vi.useRealTimers(); vi.restoreAllMocks(); });
function create() { const service = new WhatsAppService(); services.push(service); return service; }
function pending() { let resolve!: () => void; const promise = new Promise<void>(done => { resolve = done; }); return { promise, resolve }; }

describe('Carga diferida y preparación revocable de WhatsApp', () => {
  it('carga el SDK con sesión y permite cancelar mientras se importa', async () => {
    const service = create();
    expect(mocks.loaded).not.toHaveBeenCalled();
    setAuthState({ authenticated: false, userId: null });
    await service.connect();
    expect(mocks.loaded).not.toHaveBeenCalled();
    setAuthState({ authenticated: true, userId: 'a' });
    const wait = pending();
    mocks.loaded.mockReturnValueOnce(wait.promise);
    const attempt = service.connect();
    try {
      await vi.waitFor(() => expect(mocks.loaded).toHaveBeenCalledOnce());
      await service.disconnect();
    } finally {
      wait.resolve();
    }
    await attempt;
    expect(mocks.mkdir).not.toHaveBeenCalled();
    expect(mocks.socket).not.toHaveBeenCalled();
    await service.connect();
    expect(mocks.loaded).toHaveBeenCalledTimes(1);
    expect(mocks.socket).toHaveBeenCalledTimes(1);
  });

  it('comparte llamadas concurrentes y crea un único socket', async () => {
    const service = create();
    const first = service.connect(), second = service.connect();
    expect(first).toBe(second);
    await Promise.all([first, second]);
    expect(mocks.socket).toHaveBeenCalledTimes(1);
  });

  it('desconectar durante filesystem impide crear un socket', async () => {
    const wait = pending(); mocks.mkdir.mockReturnValueOnce(wait.promise);
    const service = create(), attempt = service.connect();
    await vi.waitFor(() => expect(mocks.mkdir).toHaveBeenCalled());
    await service.disconnect(); wait.resolve(); await attempt;
    expect(mocks.socket).not.toHaveBeenCalled();
  });

  it('el intento antiguo de otra sesión no crea socket ni limpia el intento nuevo', async () => {
    const wait = pending(); mocks.mkdir.mockReturnValueOnce(wait.promise);
    const service = create(), first = service.connect();
    await vi.waitFor(() => expect(mocks.mkdir).toHaveBeenCalled());
    setAuthState({ authenticated: true, userId: 'otro' });
    const nextVersion = pending();
    mocks.version.mockReturnValueOnce(nextVersion.promise.then(() => ({ version: [2, 1, 1] })));
    const second = service.connect();
    await vi.waitFor(() => expect(mocks.version).toHaveBeenCalled());
    wait.resolve(); await first;
    expect(service.connect()).toBe(second);
    nextVersion.resolve(); await second;
    expect(mocks.socket).toHaveBeenCalledTimes(1);
    expect(service.sock).not.toBeNull();
  });

  it('revoca preparación tras espera de versión y permite reintentar tras error', async () => {
    const wait = pending(); mocks.version.mockReturnValueOnce(wait.promise.then(() => ({ version: [2, 1, 1] })));
    const service = create(), attempt = service.connect();
    await vi.waitFor(() => expect(mocks.version).toHaveBeenCalled());
    setAuthState({ authenticated: false, userId: null }); wait.resolve(); await attempt;
    expect(mocks.socket).not.toHaveBeenCalled();
    setAuthState({ authenticated: true, userId: 'a' });
    mocks.version.mockRejectedValueOnce(new Error('Sin red'));
    await expect(service.connect()).rejects.toThrow('Sin red');
    await service.connect(); expect(mocks.socket).toHaveBeenCalledTimes(1);
  });

  it('libera transporte y estado incluso si logout falla', async () => {
    const service = create(); await service.connect();
    mocks.logout.mockRejectedValueOnce(new Error('Canal caído'));
    await expect(service.disconnect()).rejects.toThrow('Canal caído');
    expect(service.sock).toBeNull(); expect(service.connected).toBe(false);
    expect(mocks.end).toHaveBeenCalled();
  });

  it('desconectar cancela un reintento aunque ya no quede socket', async () => {
    vi.useFakeTimers();
    const service = create();
    scheduleWhatsAppReconnect(service, 2000);
    await service.disconnect();
    await vi.advanceTimersByTimeAsync(10000);
    expect(mocks.socket).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
