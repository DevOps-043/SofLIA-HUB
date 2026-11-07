import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { requestRemoteNode } from '../remote-node/node-client';
import type { RemoteNodeRecord } from '../../src/shared/remote-node';
const node: RemoteNodeRecord = { id: 'node-1', name: 'Nodo QA', baseUrl: 'https://node.invalid', token: 'token-qa-ficticio', enabled: true, createdAt: '2026-10-26', updatedAt: '2026-10-26' };
const save = vi.fn();
beforeEach(() => { save.mockClear(); node.lastHealthAt = null; node.lastError = null; node.capabilities = ['open_application']; });
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });
const request = (context?: { assertCurrent(): void; signal?: AbortSignal }) => Reflect.apply(requestRemoteNode, undefined, [node, 'GET', '/health', save, undefined, context]);
describe('Transporte remoto bajo autoridad y límites', () => {
  it('rechaza redirect y conserva metadata', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 302, headers: { location: 'https://otro.invalid' } }));
    await expect(request()).rejects.toThrow(); expect(save).not.toHaveBeenCalled(); expect(node.lastHealthAt).toBeNull();
    expect(vi.mocked(fetch).mock.calls[0][1]).toMatchObject({ redirect: 'error' });
  });
  it('rechaza content-length superior a 20 MiB antes de interpretar', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { headers: { 'content-length': String(20 * 1024 * 1024 + 1) } }));
    await expect(request()).rejects.toThrow(); expect(save).not.toHaveBeenCalled();
  });
  it('no envía una petición bajo revisión revocada', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));
    await expect(request({ assertCurrent: () => { throw new Error('Contexto vencido'); } })).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled(); expect(save).not.toHaveBeenCalled();
  });
  it('no publica metadata si se revoca durante fetch', async () => {
    let current = true;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => { current = false; return new Response('{"capabilities":["nueva"]}'); });
    await expect(request({ assertCurrent: () => { if (!current) throw new Error('Revocado'); } })).rejects.toThrow();
    expect(save).not.toHaveBeenCalled(); expect(node.capabilities).toEqual(['open_application']);
  });
  it.each(['file:///privado', 'https://usuario:clave@node.invalid', 'https://node.invalid?token=privado'])('rechaza destinos heredados inválidos: %s', async baseUrl => {
    const previous = node.baseUrl; const fetch = vi.spyOn(globalThis, 'fetch');
    node.baseUrl = baseUrl;
    try { await expect(request()).rejects.toThrow(); expect(fetch).not.toHaveBeenCalled(); }
    finally { node.baseUrl = previous; }
  });
  it('el límite usa bytes reales aunque Content-Length mienta', async () => {
    const cancel = vi.fn(); let index = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) { if (++index <= 2) controller.enqueue(new Uint8Array(11 * 1024 * 1024)); else return new Promise(() => undefined); }, cancel,
    });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(body, { headers: { 'content-length': '1' } }));
    await expect(request()).rejects.toThrow('límite'); expect(save).not.toHaveBeenCalled(); expect(cancel).toHaveBeenCalledOnce();
  });
  it('el plazo de 60 segundos termina incluso un fetch que ignora AbortSignal', async () => {
    vi.useFakeTimers();
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise(() => undefined));
    const pending = request(); const rejected = expect(pending).rejects.toThrow('cancelada');
    await vi.advanceTimersByTimeAsync(60_001); await rejected;
    expect(fetch.mock.calls[0][1]?.signal?.aborted).toBe(true); expect(save).not.toHaveBeenCalled();
  });
  it('cancelar durante lectura libera el stream y no publica metadata', async () => {
    const cancel = vi.fn(); const controller = new AbortController();
    let started!: () => void; const reading = new Promise<void>(resolve => { started = resolve; });
    const body = new ReadableStream<Uint8Array>({ pull() { started(); return new Promise(() => undefined); }, cancel });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(body));
    const pending = request({ assertCurrent: vi.fn(), signal: controller.signal }); const rejected = expect(pending).rejects.toThrow('cancelada');
    await reading; await Promise.resolve(); controller.abort(); await rejected;
    expect(cancel).toHaveBeenCalledOnce(); expect(save).not.toHaveBeenCalled();
  });
  it('las tareas superan un minuto y vencen a los 15 minutos con cancelación física', async () => {
    vi.useFakeTimers();
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise(() => undefined));
    const pending = requestRemoteNode(node, 'POST', '/v1/desktop/execute-task', save, { task: 'Tarea ficticia' });
    const rejected = expect(pending).rejects.toThrow('cancelada');
    await vi.advanceTimersByTimeAsync(60_001);
    expect(fetch.mock.calls[0][1]?.signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(15 * 60_000 - 60_001); await rejected;
    expect(fetch.mock.calls[0][1]?.signal?.aborted).toBe(true); expect(save).not.toHaveBeenCalled();
  });
  it('señal ya cancelada no inicia transporte', async () => {
    const controller = new AbortController(); controller.abort();
    const fetch = vi.spyOn(globalThis, 'fetch');
    await expect(request({ assertCurrent: vi.fn(), signal: controller.signal })).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled(); expect(save).not.toHaveBeenCalled();
  });
  it('errores HTTP y transporte no se reflejan en metadata', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('{"error":"credencial-privada-ficticia"}', { status: 500 }));
    await expect(request()).rejects.toThrow('HTTP 500'); expect(node.lastError).toBe('HTTP 500');
    vi.mocked(fetch).mockRejectedValueOnce(new Error('otra-credencial-privada-ficticia'));
    await expect(request()).rejects.toThrow('No se pudo contactar');
    expect(node.lastError).toBe('No se pudo contactar el nodo remoto.');
  });
});
