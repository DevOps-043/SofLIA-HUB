import { afterEach, describe, expect, it, vi } from 'vitest';
import { normalizeProjectHubEndpoint, ProjectHubTransport } from '../project-hub/transport';
import { MAX_PROJECT_HUB_BODY_BYTES, ProjectHubError } from '../project-hub/session-contract';

const context = () => ({ accessToken: 'acceso-ficticio-A', signal: new AbortController().signal, assert: () => {} });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('Transporte Project Hub acotado', () => {
  it.each(['http://remoto.example.test', 'https://usuario:clave@example.test', 'https://api.example.test/?token=ficticio', 'https://api.example.test/#fragmento', 'file:///tmp/prueba', 'no-url'])('rechaza endpoint inseguro o ambiguo: %s', endpoint => {
    expect(normalizeProjectHubEndpoint(endpoint)).toBe('');
  });
  it.each(['https://api.example.test', 'http://127.0.0.1:1234', 'http://localhost:1234', 'http://[::1]:1234'])('permite HTTPS o loopback explícito: %s', endpoint => {
    expect(normalizeProjectHubEndpoint(endpoint)).toBe(endpoint);
  });
  it('reintenta GET de red conservando la credencial capturada y correlación', async () => {
    const captured = context(); const headers: Headers[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_url: string, options: RequestInit) => {
      headers.push(new Headers(options.headers));
      if (headers.length === 1) { captured.accessToken = 'otro-token-ficticio'; throw new TypeError('red-ficticia'); }
      return Response.json({ data: [] });
    }));
    const transport = new ProjectHubTransport('https://api.example.test');
    expect((await transport.request('/api/v1/test', {}, captured)).data).toEqual([]);
    expect(headers.map(header => header.get('authorization'))).toEqual(['Bearer acceso-ficticio-A', 'Bearer acceso-ficticio-A']);
    expect(headers[0].get('x-correlation-id')).toBe(headers[1].get('x-correlation-id'));
  });
  it.each(['POST', 'PATCH', 'DELETE'] as const)('no repite una mutación después de error de red: %s', method => {
    const fetch = vi.fn(async () => { throw new TypeError('red-ficticia'); }); vi.stubGlobal('fetch', fetch);
    const transport = new ProjectHubTransport('https://api.example.test');
    return expect(transport.request('/api/v1/test', { method }, context())).rejects.toMatchObject({ code: 'UNAVAILABLE' }).then(() => {
      expect(fetch).toHaveBeenCalledTimes(1);
    });
  });
  it('cancela el backoff de lectura sin iniciar otro intento de red', async () => {
    const controller = new AbortController();
    const fetch = vi.fn(async () => { throw new TypeError('red-ficticia'); }); vi.stubGlobal('fetch', fetch);
    const transport = new ProjectHubTransport('https://api.example.test');
    const rejected = expect(transport.request('/api/v1/test', {}, { ...context(), signal: controller.signal, assert: () => {
      if (controller.signal.aborted) throw new ProjectHubError('SESSION_CHANGED', 'La sesión cambió.');
    } })).rejects.toMatchObject({ code: 'SESSION_CHANGED' });
    await Promise.resolve(); await Promise.resolve(); controller.abort(); await rejected;
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('el timeout de HTTP aborta y no deja timer ni excepción cruda', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn((_url: string, options: RequestInit) => new Promise<Response>((_resolve, reject) => {
      options.signal!.addEventListener('abort', () => reject(new DOMException('ficticio-sensible', 'AbortError')), { once: true });
    })));
    const transport = new ProjectHubTransport('https://api.example.test');
    const rejected = expect(transport.request('/api/v1/test', { method: 'POST', retry: false }, context())).rejects.toMatchObject({ code: 'TIMEOUT' });
    await vi.advanceTimersByTimeAsync(15_000); await rejected;
    expect(vi.getTimerCount()).toBe(0);
  });
  it.each([null, [], {}, { error: { message: 'secreto-ficticio' } }, { data: {}, error: { code: 'secreto' } }])('rechaza envelope inválido sin repetirlo: %#', async payload => {
    const fetch = vi.fn(async () => Response.json(payload)); vi.stubGlobal('fetch', fetch);
    const transport = new ProjectHubTransport('https://api.example.test');
    await expect(transport.request('/api/v1/test', {}, context())).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('rechaza UTF-8 inválido en lugar de reemplazar silenciosamente bytes', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(Buffer.from([123, 34, 100, 97, 116, 97, 34, 58, 34, 0xff, 34, 125]))));
    const transport = new ProjectHubTransport('https://api.example.test');
    await expect(transport.request('/api/v1/test', {}, context())).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });
  it('rechaza cuerpo excesivo/circular y clave de operación insegura antes de red', async () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    const transport = new ProjectHubTransport('https://api.example.test');
    const cyclic: { self?: unknown } = {}; cyclic.self = cyclic;
    for (const body of [cyclic, { data: 'x'.repeat(MAX_PROJECT_HUB_BODY_BYTES) }]) {
      await expect(transport.request('/api/v1/test', { method: 'POST', body }, context())).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
    }
    await expect(transport.request('/api/v1/test', { method: 'POST', idempotencyKey: 'ficticio\r\ninyectado' }, context())).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
    expect(fetch).not.toHaveBeenCalled();
  });
  it('invalida el intento sin red cuando la identidad ya cambió', async () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    const transport = new ProjectHubTransport('https://api.example.test');
    await expect(transport.request('/api/v1/test', {}, { ...context(), assert: () => { throw new ProjectHubError('SESSION_CHANGED', 'La sesión cambió.'); } })).rejects.toMatchObject({ code: 'SESSION_CHANGED' });
    expect(fetch).not.toHaveBeenCalled();
  });
});
