import { PassThrough, Readable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dispatchHostRoute } from '../remote-node/host-routes';
import { isAuthorized, readJsonBody } from '../remote-node/host-utils';
import { buildDefaultState } from '../remote-node/state-utils';
import type { RemoteNodeDeps, RemoteNodeServerContext } from '../remote-node/types';
const tools = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock('../computer-use-handlers', () => ({ executeToolDirect: tools.execute }));
let context: RemoteNodeServerContext; let cancellation: AbortController;
beforeEach(() => {
  tools.execute.mockReset().mockResolvedValue({ success: true }); cancellation = new AbortController();
  const state = buildDefaultState(); state.host.enabled = true;
  context = { state, deps: null, getListeningUrl: () => 'http://127.0.0.1', signal: cancellation.signal, assertCurrent: () => { if (cancellation.signal.aborted) throw new Error('Sesión revocada'); } };
});
afterEach(() => vi.useRealTimers());
const response = () => Object.assign({ destroyed: false, writableEnded: false }, { writeHead: vi.fn(), end: vi.fn() });
const request = (body: unknown, method = 'POST') => Object.assign(Readable.from([Buffer.from(JSON.stringify(body))]), { headers: {}, method }) as unknown as IncomingMessage;
const dispatch = (body: unknown, route: string, res = response()) => dispatchHostRoute(request(body), res as unknown as ServerResponse, new URL(route, 'http://127.0.0.1'), context);
describe('Host entrante vinculado a sesión sin sockets reales', () => {
  it('bearer sólo sirve mientras el host esté habilitado y no acepta tokens ajenos', () => {
    const req = { headers: { authorization: 'Bearer ' + context.state.host.token } } as IncomingMessage;
    expect(isAuthorized(req, context.state)).toBe(true);
    context.state.host.enabled = false; expect(isAuthorized(req, context.state)).toBe(false);
    context.state.host.enabled = true; req.headers.authorization = 'Bearer otro-token'; expect(isAuthorized(req, context.state)).toBe(false);
  });
  it.each([
    ['/v1/open-application', { path: 'calculadora' }], ['/v1/run-background-command', { command: 'Comando ficticio' }], ['/v1/take-screenshot', {}],
  ] as const)('valida y admite datos esperados: %s', async (route, body) => {
    const res = response(); await dispatch(body, route, res); expect(tools.execute).toHaveBeenCalledOnce(); expect(res.end).toHaveBeenCalledWith('{"success":true}');
  });
  it.each([null, [], 42, { path: 'calculadora', token: 'campo extra' }])('rechaza cuerpo inválido antes de efectos: %#', async body => {
    await expect(dispatch(body, '/v1/open-application')).rejects.toThrow(); expect(tools.execute).not.toHaveBeenCalled();
  });
  it('revocar mientras llega el cuerpo impide admitir una herramienta', async () => {
    const req = Object.assign(new PassThrough(), { headers: {}, method: 'POST' });
    const pending = dispatchHostRoute(req as unknown as IncomingMessage, response() as unknown as ServerResponse, new URL('http://127.0.0.1/v1/open-application'), context);
    const rejected = expect(pending).rejects.toThrow(); req.write('{"path":'); await Promise.resolve(); cancellation.abort(); await rejected;
    expect(tools.execute).not.toHaveBeenCalled();
  });
  it('no publica una respuesta después de revocar una herramienta admitida', async () => {
    tools.execute.mockImplementationOnce(async () => { cancellation.abort(); return { secreto: 'dato ficticio privado' }; });
    const res = response(); await expect(dispatch({ path: 'calculadora' }, '/v1/open-application', res)).rejects.toThrow(); expect(res.end).not.toHaveBeenCalled();
  });
  it('tarea recibe la señal y no publica resultado tardío', async () => {
    const executeTask = vi.fn(async (_task: string, options: { signal: AbortSignal }) => { cancellation.abort(); expect(options.signal.aborted).toBe(true); return 'Resultado privado ficticio'; });
    context.deps = { desktopAgent: { executeTask, getStatus: vi.fn() } } as unknown as RemoteNodeDeps;
    const res = response(); await expect(dispatch({ task: 'Tarea ficticia' }, '/v1/desktop/execute-task', res)).rejects.toThrow();
    expect(executeTask).toHaveBeenCalledOnce(); expect(res.end).not.toHaveBeenCalled();
  });
  it('cuota por bytes reales no confía en cabecera pequeña', async () => {
    const req = Object.assign(Readable.from([Buffer.alloc(128 * 1024 + 1)]), { headers: { 'content-length': '1' } });
    await expect(readJsonBody(req as unknown as IncomingMessage, context)).rejects.toThrow('excesivo');
  });
  it('cuerpo pendiente vence a los 15 segundos y libera lectura', async () => {
    vi.useFakeTimers(); const req = Object.assign(new PassThrough(), { headers: {} });
    const pending = readJsonBody(req as unknown as IncomingMessage, context); const rejected = expect(pending).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(15001); await rejected; expect(req.destroyed).toBe(true);
  });
});
