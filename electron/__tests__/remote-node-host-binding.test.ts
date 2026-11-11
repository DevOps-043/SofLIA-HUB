import { EventEmitter } from 'node:events';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { syncRemoteNodeServer } from '../remote-node/host-server';
import { buildDefaultState } from '../remote-node/state-utils';
import type { RemoteNodeServerContext } from '../remote-node/types';
const ports = vi.hoisted(() => ({ createServer: vi.fn(), dispatch: vi.fn() }));
vi.mock('node:http', () => ({ default: { createServer: ports.createServer } }));
vi.mock('../remote-node/host-routes', () => ({ dispatchHostRoute: ports.dispatch }));
class FakeServer extends EventEmitter {
  listening = false; host = ''; port = 0;
  listen = vi.fn((port: number, host: string, ready: () => void) => { this.port = port; this.host = host; this.listening = true; ready(); });
  close = vi.fn((ready: () => void) => { this.listening = false; ready(); });
  closeAllConnections = vi.fn();
  address() { return { port: this.port, address: this.host, family: 'IPv4' }; }
}
let created: FakeServer[];
let context: RemoteNodeServerContext;
beforeEach(() => {
  ports.dispatch.mockReset().mockResolvedValue(undefined);
  created = []; ports.createServer.mockReset().mockImplementation(() => { const server = new FakeServer(); created.push(server); return server; });
  const state = buildDefaultState(); state.host.enabled = true;
  context = { state, deps: null, getListeningUrl: () => 'http://127.0.0.1', assertCurrent: vi.fn(), signal: new AbortController().signal };
});
describe('Binding del servidor remoto sin sockets reales', () => {
  it('cambiar interfaz con el mismo puerto cierra el binding anterior', async () => {
    context.state.host.bindAddress = '0.0.0.0';
    const first = await syncRemoteNodeServer(null, context);
    context.state.host.bindAddress = '127.0.0.1';
    const second = await syncRemoteNodeServer(first, context);
    expect(second).not.toBe(first); expect(created[0].close).toHaveBeenCalledOnce();
    expect(created[1].host).toBe('127.0.0.1');
  });
  it('reutiliza únicamente la misma interfaz/puerto y detiene al deshabilitar', async () => {
    const first = await syncRemoteNodeServer(null, context);
    expect(await syncRemoteNodeServer(first, context)).toBe(first);
    expect(ports.createServer).toHaveBeenCalledOnce();
    context.state.host.enabled = false;
    expect(await syncRemoteNodeServer(first, context)).toBeNull(); expect(created[0].close).toHaveBeenCalledOnce();
  });
  it('un servidor no reconocido se vuelve a enlazar en la interfaz revisada', async () => {
    const legacy = new FakeServer(); legacy.listening = true; legacy.port = context.state.host.port; legacy.host = '0.0.0.0';
    await syncRemoteNodeServer(legacy as unknown as Server, context);
    expect(legacy.close).toHaveBeenCalledOnce(); expect(created[0].host).toBe('127.0.0.1');
  });
  it('otra identidad reinicia el host aunque conserve interfaz y puerto', async () => {
    const first = await syncRemoteNodeServer(null, context);
    const next = { ...context, state: { ...context.state, host: { ...context.state.host }, nodes: [] }, signal: new AbortController().signal };
    expect(await syncRemoteNodeServer(first, next)).not.toBe(first); expect(created[0].close).toHaveBeenCalledOnce();
  });
  it('revocar identidad cierra conexiones y el límite de ocho rechaza extras', async () => {
    const controller = new AbortController(); context.signal = controller.signal;
    await syncRemoteNodeServer(null, context);
    const sockets = Array.from({ length: 9 }, () => Object.assign(new EventEmitter(), { destroy: vi.fn() }));
    sockets.forEach(socket => created[0].emit('connection', socket));
    expect(sockets[8].destroy).toHaveBeenCalledOnce(); controller.abort(); expect(created[0].closeAllConnections).toHaveBeenCalledOnce();
    expect(created[0]).toMatchObject({ headersTimeout: 10000, requestTimeout: 15000, maxHeadersCount: 32 });
  });
  it('una petición sin bearer no llega al dispatcher ni recibe datos privados', async () => {
    await syncRemoteNodeServer(null, context);
    const handler = ports.createServer.mock.calls[0][0] as (req: IncomingMessage, res: ServerResponse) => void;
    const req = Object.assign(new EventEmitter(), { headers: {}, url: '/health', method: 'GET' });
    const res = Object.assign(new EventEmitter(), { destroyed: false, writableEnded: false, writeHead: vi.fn(), end: vi.fn() });
    handler(req as unknown as IncomingMessage, res as unknown as ServerResponse);
    expect(res.writeHead).toHaveBeenCalledWith(401, expect.any(Object)); expect(ports.dispatch).not.toHaveBeenCalled();
  });
  it('rotar token durante una espera invalida la petición admitida con el anterior', async () => {
    let release!: () => void;
    ports.dispatch.mockImplementationOnce(async (_req, _res, _url, requestContext: RemoteNodeServerContext) => {
      await new Promise<void>(resolve => { release = resolve; }); requestContext.assertCurrent();
      throw new Error('No debe alcanzar datos privados');
    });
    await syncRemoteNodeServer(null, context);
    const handler = ports.createServer.mock.calls[0][0] as (req: IncomingMessage, res: ServerResponse) => void;
    const req = Object.assign(new EventEmitter(), { headers: { authorization: 'Bearer ' + context.state.host.token }, url: '/health', method: 'GET' });
    const res = Object.assign(new EventEmitter(), { destroyed: false, writableEnded: false, writeHead: vi.fn(), end: vi.fn() });
    handler(req as unknown as IncomingMessage, res as unknown as ServerResponse);
    context.state.host.token = 'token-rotado-ficticio'; release();
    await vi.waitFor(() => expect(res.end).toHaveBeenCalledOnce());
    expect(res.end).toHaveBeenCalledWith('{"success":false,"error":"Error interno del nodo remoto."}');
    expect(req.listenerCount('aborted')).toBe(0);
  });
});
