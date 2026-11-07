import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchGroundedContent } from '../../src/shared/grounded-http';
import { validateGroundingInput } from '../../src/shared/grounded-generation';
import { AiGroundingService } from '../ai-grounding-service';
const credential = 'credencial-ficticia-test';
const key = async () => credential;
const input = () => validateGroundingInput({ requestId: 'req', modelName: 'gemini-3-test', body: { contents: [{ role: 'user', parts: [{ text: 'Prueba' }] }], tools: [{ google_search: {} }, { code_execution: {} }] } });
afterEach(() => vi.restoreAllMocks());
describe('HTTP de investigación acotado sin errores privados', () => {
  it('usa endpoint fijo, header de clave y rechaza redirects', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 302 }));
    await expect(fetchGroundedContent(input(), credential, new AbortController().signal)).rejects.toThrow();
    expect(String(fetch.mock.calls[0][0])).not.toContain(credential);
    expect(fetch.mock.calls[0][1]).toMatchObject({ redirect: 'error', headers: { 'x-goog-api-key': credential } });
  });
  it.each(['null', '[]', '42', 'JSON inválido'])('rechaza respuesta no objeto: %s', async raw => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(raw));
    await expect(fetchGroundedContent(input(), credential, new AbortController().signal)).rejects.toThrow('proveedor');
  });
  it('rechaza content-length excesivo sin publicar cuerpo', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { headers: { 'content-length': String(8 * 1024 * 1024 + 1) } }));
    await expect(fetchGroundedContent(input(), credential, new AbortController().signal)).rejects.toThrow();
  });
  it('limita bytes reales si el proveedor falsea la cabecera', async () => {
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({ pull(controller) { controller.enqueue(new Uint8Array(5 * 1024 * 1024)); }, cancel });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(body, { headers: { 'content-length': '1' } }));
    await expect(fetchGroundedContent(input(), credential, new AbortController().signal)).rejects.toThrow(); expect(cancel).toHaveBeenCalledOnce();
  });
  it('cancelar una lectura pendiente libera el stream', async () => {
    const cancel = vi.fn(), controller = new AbortController(); let started!: () => void;
    const reading = new Promise<void>(resolve => { started = resolve; });
    const body = new ReadableStream<Uint8Array>({ pull() { started(); return new Promise(() => undefined); }, cancel });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(body));
    const pending = fetchGroundedContent(input(), credential, controller.signal); const rejected = expect(pending).rejects.toThrow();
    await reading; await Promise.resolve(); controller.abort(); await rejected; expect(cancel).toHaveBeenCalledOnce();
  });
  it('cuatro transportes físicos ocupan plazas y el quinto no envía', async () => {
    const releases: Array<(value: Response) => void> = [];
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise(resolve => { releases.push(resolve); }));
    const service = new AiGroundingService();
    const authorities = Array.from({ length: 5 }, () => ({ frame: {}, user: 'usuario', signal: new AbortController().signal, assertCurrent: () => undefined, key }));
    const senders = authorities.map(() => ({}));
    const pending = senders.slice(0, 4).map((sender, index) => service.generate(sender, input(), authorities[index]));
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(4));
    expect(await service.generate(senders[4], input(), authorities[4])).toMatchObject({ code: 'BUSY' });
    for (let index = 0; index < 4; index++) service.cancel(senders[index], 'req', authorities[index].frame, 'usuario');
    expect((await Promise.all(pending)).every(result => !result.success)).toBe(true);
    expect(await service.generate(senders[4], input(), authorities[4])).toMatchObject({ code: 'BUSY' });
    releases.forEach(release => release(new Response('{}'))); for (let index = 0; index < 16; index++) await Promise.resolve();
  });
  it('cancelar lectura retiene plaza hasta resolver el cierre físico del stream', async () => {
    let release!: () => void, reading!: () => void;
    const started = new Promise<void>(resolve => { reading = resolve; });
    const closed = new Promise<void>(resolve => { release = resolve; });
    const body = new ReadableStream<Uint8Array>({ pull() { reading(); return new Promise(() => undefined); }, cancel: () => closed });
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(body));
    const service = new AiGroundingService(), sender = {}, frame = {};
    const authority = { frame, user: 'usuario', signal: new AbortController().signal, assertCurrent: () => undefined, key };
    const pending = service.generate(sender, input(), authority); await started; await Promise.resolve();
    service.cancel(sender, 'req', frame, 'usuario'); expect(await pending).toMatchObject({ code: 'CANCELLED' });
    expect(await service.generate(sender, input(), authority)).toMatchObject({ code: 'BUSY' });
    release(); for (let index = 0; index < 20; index++) await Promise.resolve();
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}'));
    expect(await service.generate(sender, input(), authority)).toMatchObject({ success: true });
  });
});
