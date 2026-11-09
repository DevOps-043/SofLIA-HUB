import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import http from 'node:http';
import { createHash } from 'node:crypto';

interface TestWindow extends EventEmitter {
  close: () => void; isDestroyed: () => boolean;
  webContents: { on: ReturnType<typeof vi.fn>; setWindowOpenHandler: ReturnType<typeof vi.fn> };
}
const windows = vi.hoisted(() => [] as TestWindow[]);
const actions = vi.hoisted(() => ({ load: vi.fn<(url: string) => Promise<void>>(), external: vi.fn<(url: string) => Promise<void>>() }));
vi.mock('electron', () => ({ BrowserWindow: class extends EventEmitter {
  webContents = { on: vi.fn(), setWindowOpenHandler: vi.fn() };
  private destroyed = false;
  constructor() { super(); windows.push(this); }
  loadURL(url: string) { return actions.load(url); }
  isDestroyed() { return this.destroyed; }
  show() {}
  close() { if (!this.destroyed) { this.destroyed = true; this.emit('closed'); } }
  destroy() { this.close(); }
}, shell: { openExternal: actions.external } }));
import { openOAuthWindow } from '../calendar/oauth-window';
import { createOAuthProof } from '../calendar/oauth-proof';
import { resetAuthStateForTests, setAuthState } from '../main/auth-state';

beforeEach(() => { resetAuthStateForTests(); actions.load.mockReset().mockResolvedValue(undefined); actions.external.mockReset().mockResolvedValue(undefined); });
afterEach(async () => { windows.forEach(window => window.close()); windows.length = 0; await vi.advanceTimersByTimeAsync(300000); vi.useRealTimers(); resetAuthStateForTests(); });

it('callback con state ajeno se rechaza sin devolver código, con HTTP local real', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  const state = 'a'.repeat(43);
  const verifier = 'b'.repeat(43);
  const proof = { state, verifier, challenge: createHash('sha256').update(verifier).digest('base64url') };
  const auth = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  auth.search = new URLSearchParams({ response_type: 'code', redirect_uri: 'http://localhost:8234/callback',
    state, code_challenge: proof.challenge, code_challenge_method: 'S256', client_id: 'ficticio' }).toString();
  const waiting = openOAuthWindow(auth.href, 'Google Calendar', { provider: 'google', clientId: 'ficticio', proof, assertCurrent: () => {} });
  const status = await new Promise<number>((resolve, reject) => {
    http.get('http://127.0.0.1:8234/callback?code=ficticio&state=ajeno', response => { response.resume(); response.once('end', () => resolve(response.statusCode!)); }).on('error', reject);
  });
  try { expect(status).toBe(403); }
  finally { windows.forEach(window => window.close()); await vi.advanceTimersByTimeAsync(1000); await waiting; }
  expect(await waiting).toBeNull();
});

function fixture(assertCurrent = () => {}) {
  const proof = createOAuthProof(); const auth = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  auth.search = new URLSearchParams({ client_id: 'ficticio', response_type: 'code', state: proof.state,
    redirect_uri: 'http://localhost:8234/callback', code_challenge: proof.challenge, code_challenge_method: 'S256' }).toString();
  const options = { provider: 'google' as const, clientId: 'ficticio', proof, assertCurrent };
  return { proof, auth, options };
}
function callback(state: string) {
  return new Promise<void>((resolve, reject) => {
    http.get(`http://127.0.0.1:8234/callback?state=${state}&code=ficticio`, response => { response.resume(); response.once('end', resolve); }).once('error', reject);
  });
}

it('sólo carga estado local y abre proveedor externo después de escuchar', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  const flow = fixture();
  actions.external.mockImplementationOnce(async () => { await callback(flow.proof.state); });
  const code = await openOAuthWindow(flow.auth.href, 'Google Calendar', flow.options);
  expect(code).toBe('ficticio'); expect(actions.external).toHaveBeenCalledWith(flow.auth.href);
  expect(actions.load.mock.calls[0][0]).toMatch(/^data:text\/html/);
  expect(decodeURIComponent(actions.load.mock.calls[0][0])).not.toContain(flow.proof.state);
  expect(windows[0].webContents.setWindowOpenHandler.mock.calls[0][0]()).toEqual({ action: 'deny' });
  const navigation = { preventDefault: vi.fn() }; windows[0].webContents.on.mock.calls[0][1](navigation);
  expect(navigation.preventDefault).toHaveBeenCalled(); expect(windows[0].isDestroyed()).toBe(true);
});

it('cancelar una carga local pendiente no espera su resolución ni abre navegador', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  actions.load.mockReturnValueOnce(new Promise(() => {}));
  const flow = fixture(); const waiting = openOAuthWindow(flow.auth.href, 'Google Calendar', flow.options);
  await vi.waitFor(() => expect(windows.length).toBe(1)); windows[0].close();
  expect(await waiting).toBeNull(); expect(actions.external).not.toHaveBeenCalled();
});

it('cancelar durante apertura externa pendiente retira el intento y observa rechazo tardío', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  let reject!: (error: Error) => void;
  actions.external.mockReturnValueOnce(new Promise((_resolve, failed) => { reject = failed; }));
  const flow = fixture(); const waiting = openOAuthWindow(flow.auth.href, 'Google Calendar', flow.options);
  await vi.waitFor(() => expect(actions.external).toHaveBeenCalled()); windows[0].close();
  expect(await waiting).toBeNull(); reject(new Error('Fallo externo ficticio tardío')); await Promise.resolve();
});

it('revocación auth retira intento y ventana aunque la carga no termine', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  let current = true; const flow = fixture(() => { if (!current) throw new Error('Sesión revocada'); });
  actions.load.mockReturnValueOnce(new Promise(() => {}));
  const outcome = openOAuthWindow(flow.auth.href, 'Google Calendar', flow.options).then(code => ({ code }), error => ({ error }));
  await vi.waitFor(() => expect(windows.length).toBe(1)); current = false;
  setAuthState({ authenticated: true, userId: 'otro' });
  expect(await outcome).toHaveProperty('error'); expect(windows[0].isDestroyed()).toBe(true); expect(actions.external).not.toHaveBeenCalled();
});

it('destino alterado no inicia listener, ventana o navegador', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  const flow = fixture(); flow.auth.hostname = 'ajeno.invalid';
  await expect(openOAuthWindow(flow.auth.href, 'Google Calendar', flow.options)).rejects.toThrow('no permitido');
  expect(windows).toHaveLength(0); expect(actions.external).not.toHaveBeenCalled();
});

it('fallo de shell retira recursos y deja continuar otro intento', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  actions.external.mockRejectedValueOnce(new Error('No hay navegador ficticio'));
  const first = fixture();
  await expect(openOAuthWindow(first.auth.href, 'Google Calendar', first.options)).rejects.toThrow();
  expect(windows[0].isDestroyed()).toBe(true);
  const second = fixture(); actions.external.mockImplementationOnce(async () => { await callback(second.proof.state); });
  expect(await openOAuthWindow(second.auth.href, 'Google Calendar', second.options)).toBe('ficticio');
});

it('puerto ocupado no abre ventana ni navegador', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  const blocker = http.createServer();
  await new Promise<void>((resolve, reject) => blocker.once('error', reject).listen(8234, '127.0.0.1', resolve));
  try {
    const flow = fixture(); await expect(openOAuthWindow(flow.auth.href, 'Google Calendar', flow.options)).rejects.toThrow('recepción OAuth');
    expect(windows).toHaveLength(0); expect(actions.external).not.toHaveBeenCalled();
  } finally { await new Promise<void>(resolve => blocker.close(() => resolve())); }
});

it('vence sin callback y retira ventana y listener', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  const flow = fixture(); const waiting = openOAuthWindow(flow.auth.href, 'Google Calendar', flow.options);
  await vi.waitFor(() => expect(actions.external).toHaveBeenCalled());
  await vi.advanceTimersByTimeAsync(300000);
  expect(await waiting).toBeNull(); expect(windows[0].isDestroyed()).toBe(true);
});
