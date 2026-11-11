import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Response as ModelResponse, ResponseStreamEvent } from 'openai/resources/responses/responses';
import { OpenAIJobService } from '../openai-runtime/job-service';
import { OPENAI_RUNTIME_LIMITS, validateOpenAIRequest } from '../../src/shared/openai-runtime';
import type { OpenAIProvider, OpenAIScope } from '../openai-runtime/types';

function scope(id = 'scope'): { scope: OpenAIScope; abort: AbortController } {
  const abort = new AbortController();
  return { abort, scope: { id, sender: {}, frame: {}, userId: 'usuario', authority: { signal: abort.signal, assert: () => { if (abort.signal.aborted) throw new Error('revocada'); }, key: async () => 'clave-ficticia', dispose: vi.fn() } } };
}
const body = (stream = true) => validateOpenAIRequest({ model: 'gpt-6-luna', input: 'prueba', stream });
const response = () => ({ output_text: 'respuesta', output: [], usage: { total_tokens: 8 } } as unknown as ModelResponse);
const event = (text = 'hola') => ({ type: 'response.output_text.delta', delta: text } as ResponseStreamEvent);
const tick = async () => { for (let n = 0; n < 18; n++) await Promise.resolve(); };
afterEach(() => vi.useRealTimers());
describe('Trabajos físicos OpenAI y presión de lectura', () => {
  it.each([false, true])('error estructurado en respuesta normal/terminal SSE no cruza IPC: stream=%s', async stream => {
    const s = scope(), failed = { ...response(), status: 'failed', error: { code: 'invalid_api_key', message: 'sk-secreto-ficticio' } };
    const service = new OpenAIJobService(async () => stream ? { [Symbol.asyncIterator]: () => ({ next: async () => ({ done: false, value: { type: 'response.completed', response: failed } as never }) }) } : failed as ModelResponse);
    service.start(s.scope, 'uno', body(stream), 0); const result = await service.pull(s.scope, 'uno', 0);
    expect(result).toMatchObject({ success: false, code: 'PROVIDER_FAILED', reason: 'invalid_key' }); expect(JSON.stringify(result)).not.toContain('sk-secreto'); service.cancelScope(s.scope);
  });
  it('no lee stream antes de pull y conserva replay del último cursor', async () => {
    const s = scope(), next = vi.fn().mockResolvedValueOnce({ value: event(), done: false }).mockResolvedValue({ done: true }); const close = vi.fn(async () => ({ done: true as const, value: undefined }));
    const service = new OpenAIJobService(async () => ({ [Symbol.asyncIterator]: () => ({ next, return: close }) }));
    expect(service.start(s.scope, 'uno', body(), 0)).toMatchObject({ success: true }); await tick(); expect(next).not.toHaveBeenCalled();
    const first = await service.pull(s.scope, 'uno', 0); expect(first).toMatchObject({ success: true, kind: 'event', cursor: 1 });
    expect(await service.pull(s.scope, 'uno', 0)).toEqual(first); expect(next).toHaveBeenCalledOnce();
    expect(await service.pull(s.scope, 'uno', 1)).toMatchObject({ kind: 'done', cursor: 2 }); expect(close).toHaveBeenCalledOnce(); service.cancelScope(s.scope);
  });
  it('no permite dos next físicos simultáneos', async () => {
    const s = scope(); let finish!: (value: IteratorResult<ResponseStreamEvent>) => void;
    const next = vi.fn(() => new Promise<IteratorResult<ResponseStreamEvent>>(resolve => { finish = resolve; }));
    const service = new OpenAIJobService(async () => ({ [Symbol.asyncIterator]: () => ({ next }) }));
    service.start(s.scope, 'uno', body(), 0); const first = service.pull(s.scope, 'uno', 0); await tick();
    expect(await service.pull(s.scope, 'uno', 0)).toMatchObject({ code: 'BUSY' }); expect(next).toHaveBeenCalledOnce(); finish({ done: false, value: event() }); await first; service.cancelScope(s.scope);
  });
  it('cancela espera pública sin liberar proveedor físico pendiente', async () => {
    const s = scope(); const releases: ((r: ModelResponse) => void)[] = [];
    const provider: OpenAIProvider = () => new Promise(resolve => { releases.push(resolve); });
    const service = new OpenAIJobService(provider);
    for (let n = 0; n < 4; n++) service.start(s.scope, String(n), body(false), 0);
    const pending = service.pull(s.scope, '0', 0); await tick(); service.cancel(s.scope, '0');
    expect(await pending).toMatchObject({ code: 'CANCELLED' }); expect(service.start(s.scope, 'quinto', body(false), 0)).toMatchObject({ code: 'BUSY' });
    releases[0](response()); await tick(); expect(service.start(s.scope, 'quinto', body(false), 0)).toMatchObject({ success: true });
    await tick(); for (const release of releases) release(response()); service.cancelScope(s.scope); await tick();
  });
  it('no libera plaza hasta terminar next y return', async () => {
    const s = scope(); let finishNext!: (r: IteratorResult<ResponseStreamEvent>) => void, finishClose!: () => void;
    const close = vi.fn(() => new Promise<IteratorResult<ResponseStreamEvent>>(resolve => { finishClose = () => resolve({ done: true, value: undefined }); }));
    const next = vi.fn(() => new Promise<IteratorResult<ResponseStreamEvent>>(resolve => { finishNext = resolve; }));
    const service = new OpenAIJobService(async () => ({ [Symbol.asyncIterator]: () => ({ next, return: close }) }));
    for (let n = 0; n < 4; n++) service.start(s.scope, String(n), body(), 0);
    const pending = service.pull(s.scope, '0', 0); await tick(); service.cancel(s.scope, '0'); await pending;
    expect(close).not.toHaveBeenCalled(); finishNext({ done: false, value: event() }); await tick(); expect(close).toHaveBeenCalledOnce();
    expect(service.start(s.scope, 'nuevo', body(), 0)).toMatchObject({ code: 'BUSY' }); finishClose(); await tick();
    expect(service.start(s.scope, 'nuevo', body(), 0)).toMatchObject({ success: true }); service.cancelScope(s.scope); await tick();
  });
  it('respuesta normal conserva contenido/uso y libera plaza', async () => {
    const s = scope(), service = new OpenAIJobService(async () => response()); service.start(s.scope, 'uno', body(false), 0);
    expect(await service.pull(s.scope, 'uno', 0)).toMatchObject({ kind: 'response', response: { output_text: 'respuesta', usage: { total_tokens: 8 } } }); service.cancelScope(s.scope);
  });
  it('estado HTTP saneado conserva reintento sin mensaje/headers privados', async () => {
    const s = scope(), service = new OpenAIJobService(async () => { throw Object.assign(new Error('sk-secreto-ficticio y datos privados'), { status: 429, headers: new Headers({ 'retry-after': '9', authorization: 'privado' }) }); });
    service.start(s.scope, 'uno', body(false), 0); const reply = await service.pull(s.scope, 'uno', 0);
    expect(reply).toMatchObject({ code: 'PROVIDER_FAILED', status: 429, retryAfterMs: 9000 }); expect(JSON.stringify(reply)).not.toMatch(/sk-secreto|privados|authorization/); service.cancelScope(s.scope);
  });
  it('logout durante proveedor descarta respuesta tardía', async () => {
    const s = scope(); let finish!: (r: ModelResponse) => void; const service = new OpenAIJobService(() => new Promise(resolve => { finish = resolve; }));
    service.start(s.scope, 'uno', body(false), 0); const pending = service.pull(s.scope, 'uno', 0); await tick(); s.abort.abort(); expect(await pending).toMatchObject({ code: 'CANCELLED' }); finish(response()); await tick();
  });
  it('rechaza lectura desde otro objeto de scope aunque copie el ID', async () => {
    const s = scope(), service = new OpenAIJobService(async () => response()); service.start(s.scope, 'uno', body(false), 0);
    expect(await service.pull({ ...s.scope }, 'uno', 0)).toMatchObject({ code: 'IPC_DENIED' }); service.cancelScope(s.scope);
  });
  it('tiempo ocioso cierra stream abandonado', async () => {
    vi.useFakeTimers(); const s = scope(), close = vi.fn(async () => ({ done: true as const, value: undefined }));
    const service = new OpenAIJobService(async () => ({ [Symbol.asyncIterator]: () => ({ next: vi.fn(), return: close }) }));
    service.start(s.scope, 'uno', body(), 0); await tick(); await vi.advanceTimersByTimeAsync(OPENAI_RUNTIME_LIMITS.idleMs); expect(close).toHaveBeenCalledOnce();
    expect(await service.pull(s.scope, 'uno', 0)).toMatchObject({ code: 'IPC_DENIED' });
  });
  it('evento response.failed no filtra error y conserva categoría de contexto', async () => {
    const s = scope(), close = vi.fn(async () => ({ done: true as const, value: undefined }));
    const service = new OpenAIJobService(async () => ({ [Symbol.asyncIterator]: () => ({ next: async () => ({ done: false, value: { type: 'response.failed', response: { error: { code: 'context_length_exceeded', message: 'sk-secreto-ficticio' } } } as never }), return: close }) }));
    service.start(s.scope, 'uno', body(), 0); const result = await service.pull(s.scope, 'uno', 0); expect(result).toMatchObject({ code: 'PROVIDER_FAILED', reason: 'context_length' }); expect(JSON.stringify(result)).not.toContain('sk-secreto'); await tick(); expect(close).toHaveBeenCalledOnce();
  });
  it('evento excesivo falla saneado y cierra iterador', async () => {
    const s = scope(), close = vi.fn(async () => ({ done: true as const, value: undefined }));
    const service = new OpenAIJobService(async () => ({ [Symbol.asyncIterator]: () => ({ next: async () => ({ done: false, value: event('x'.repeat(OPENAI_RUNTIME_LIMITS.eventBytes + 1)) }), return: close }) }));
    service.start(s.scope, 'uno', body(), 0); expect(await service.pull(s.scope, 'uno', 0)).toMatchObject({ code: 'PROVIDER_FAILED' }); await tick(); expect(close).toHaveBeenCalledOnce();
  });
  it('ocho resultados retenidos no abren almacenamiento ilimitado', async () => {
    const s = scope(), service = new OpenAIJobService(async () => response());
    for (let n = 0; n < 8; n++) { expect(service.start(s.scope, String(n), body(false), 0)).toMatchObject({ success: true }); await tick(); }
    expect(service.start(s.scope, 'noveno', body(false), 0)).toMatchObject({ code: 'BUSY' }); service.cancelScope(s.scope); await tick();
  });
  it('plazo duro cancela una lectura que ignora señal y conserva cuota física', async () => {
    vi.useFakeTimers(); const s = scope(); let finish!: (r: IteratorResult<ResponseStreamEvent>) => void;
    const service = new OpenAIJobService(async () => ({ [Symbol.asyncIterator]: () => ({ next: () => new Promise(resolve => { finish = resolve; }) }) }));
    for (let n = 0; n < 4; n++) service.start(s.scope, String(n), body(), 0);
    const pending = service.pull(s.scope, '0', 0); await tick(); await vi.advanceTimersByTimeAsync(OPENAI_RUNTIME_LIMITS.requestMs); expect(await pending).toMatchObject({ code: 'CANCELLED' });
    // Los otros tres streams ociosos se cerraron, pero el next vivo aún ocupa una plaza.
    for (let n = 4; n < 7; n++) expect(service.start(s.scope, String(n), body(), 0)).toMatchObject({ success: true });
    expect(service.start(s.scope, 'octavo', body(), 0)).toMatchObject({ code: 'BUSY' }); finish({ done: true, value: undefined }); await tick(); service.cancelScope(s.scope);
  });
});
