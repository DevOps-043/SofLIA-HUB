import { afterEach, describe, expect, it, vi } from 'vitest';
import { getOpenAI, resetOpenAIClient } from '../../services/openai-chat/client';
import type { OpenAIRuntimeApi } from '../../shared/openai-runtime';
const ports = vi.hoisted(() => ({ key: vi.fn(async () => 'sk-clave-ficticia-que-no-debe-llegar-al-renderer'), sdk: vi.fn() }));
vi.mock('../../services/api-keys', () => ({ getApiKeyWithCache: ports.key }));
vi.mock('openai', () => ({ default: ports.sdk }));
afterEach(() => { resetOpenAIClient(); vi.clearAllMocks(); Reflect.deleteProperty(window, 'openaiRuntime'); });
describe('Cliente OpenAI de inferencia nativa', () => {
  it('abre scope nativo sin consultar ni construir credenciales en renderer', async () => {
    const open = vi.fn(async () => ({ success: true, scopeId: 'scope-ficticio' }));
    Object.defineProperty(window, 'openaiRuntime', { value: { open }, configurable: true });
    await getOpenAI();
    expect(ports.key).not.toHaveBeenCalled(); expect(ports.sdk).not.toHaveBeenCalled(); expect(open).toHaveBeenCalledOnce();
  });
  function fixture() {
    const api = { open: vi.fn<OpenAIRuntimeApi['open']>(async () => ({ success: true, scopeId: 'scope-ficticio' })), start: vi.fn<OpenAIRuntimeApi['start']>(async (_scope, requestId) => ({ success: true, requestId })), pull: vi.fn<OpenAIRuntimeApi['pull']>(), cancel: vi.fn<OpenAIRuntimeApi['cancel']>(async () => ({ success: true, cancelled: true })) };
    Object.defineProperty(window, 'openaiRuntime', { value: api, configurable: true }); return api;
  }
  it('sin puente falla cerrado sin usar SDK o clave del renderer', async () => { await expect(getOpenAI()).rejects.toThrow('puente nativo'); expect(ports.key).not.toHaveBeenCalled(); expect(ports.sdk).not.toHaveBeenCalled(); });
  it('stream lee bajo demanda y cancela al abandonar el consumidor', async () => {
    const api = fixture(); api.pull.mockResolvedValueOnce({ success: true, kind: 'event', cursor: 1, event: { type: 'response.output_text.delta', delta: 'hola', sequence_number: 0, item_id: 'ficticio', output_index: 0, content_index: 0, logprobs: [] } });
    const client = await getOpenAI(), stream = await client.responses.create({ model: 'gpt-6-luna', input: 'prueba', stream: true });
    expect(api.pull).not.toHaveBeenCalled(); for await (const event of stream) { expect(event).toMatchObject({ delta: 'hola' }); break; }
    expect(api.pull).toHaveBeenCalledOnce(); expect(api.cancel).toHaveBeenCalledOnce();
  });
  it('conserva texto/uso normales y retira trabajo', async () => {
    const api = fixture(); api.pull.mockResolvedValueOnce({ success: true, kind: 'response', cursor: 1, response: { output_text: 'texto', usage: { total_tokens: 5 } } as never });
    const client = await getOpenAI(); expect(await client.responses.create({ model: 'gpt-6-luna', input: 'prueba' })).toMatchObject({ output_text: 'texto', usage: { total_tokens: 5 } }); expect(api.cancel).toHaveBeenCalledOnce();
  });
  it('return antes del primer next también cancela el trabajo', async () => {
    const api = fixture(), client = await getOpenAI(); const stream = await client.responses.create({ model: 'gpt-6-luna', input: 'prueba', stream: true });
    await stream[Symbol.asyncIterator]().return?.(); expect(api.cancel).toHaveBeenCalled(); expect(api.pull).not.toHaveBeenCalled();
  });
  it('no admite secuencia inválida ni sigue leyendo', async () => {
    const api = fixture(); api.pull.mockResolvedValueOnce({ success: true, kind: 'done', cursor: 9 });
    const client = await getOpenAI(), stream = await client.responses.create({ model: 'gpt-6-luna', input: 'prueba', stream: true });
    const consume = async () => { for await (const event of stream) expect(event).toBeDefined(); };
    await expect(consume()).rejects.toThrow('Secuencia'); expect(api.cancel).toHaveBeenCalledOnce();
  });
  it('cancelación mientras start espera retira la admisión tardía', async () => {
    const api = fixture(); let admit!: (reply: Awaited<ReturnType<OpenAIRuntimeApi['start']>>) => void; api.start.mockImplementationOnce(() => new Promise(resolve => { admit = resolve; }));
    const client = await getOpenAI(), abort = new AbortController(), pending = client.responses.create({ model: 'gpt-6-luna', input: 'prueba' }, { signal: abort.signal });
    const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' }); abort.abort(); await rejected;
    admit({ success: true, requestId: 'tardío' }); for (let n = 0; n < 6; n++) await Promise.resolve();
    expect(api.cancel.mock.calls.length).toBeGreaterThanOrEqual(2); expect(api.pull).not.toHaveBeenCalled();
  });
  it('propaga estado/retry-after saneados sin SDK público', async () => {
    const api = fixture(); api.pull.mockResolvedValueOnce({ success: false, code: 'PROVIDER_FAILED', status: 429, retryAfterMs: 4500, error: 'dato no confiable' });
    const client = await getOpenAI(); await expect(client.responses.create({ model: 'gpt-6-luna', input: 'prueba' })).rejects.toMatchObject({ status: 429, retryAfterMs: 4500 }); expect(api.cancel).toHaveBeenCalledOnce();
  });
});
