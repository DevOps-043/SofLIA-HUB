import { afterEach, describe, expect, it, vi } from 'vitest';
import { requestNativeGrounding, GroundingBridgeError } from '../../services/grounded-generation';
import { supabase } from '../../lib/supabase';
import { getApiKeyWithCache } from '../../services/api-keys';
import { extractSources } from '../../services/gemini-chat/sources';
import { sendGroundedMessage, WEB_GROUNDING_FAILURE } from '../../services/gemini-chat/web-grounding';
vi.mock('../../services/api-keys', () => ({ getApiKeyWithCache: vi.fn(async () => 'credencial-ficticia-test') }));
vi.mock('../../lib/supabase', () => ({
  supabase: { auth: { onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })) } },
}));
vi.mock('../../config', () => ({ GOOGLE_API_KEY: '', MODELS: { WEB_AGENT: 'gemini-3-test', FALLBACK: 'gemini-3-test', PRO: 'gemini-3-test' } }));
const input = { modelName: 'gemini-3-test', body: { contents: [{ role: 'user', parts: [{ text: 'Prueba' }] }], tools: [{ google_search: {} }] } };
const messageInput = () => ({ candidateModelIds: ['gemini-3-test'], finalMessage: 'Investiga datos de prueba', messageContent: 'Consulta ficticia', systemInstruction: 'Prueba', history: [], generationConfig: {}, allToolCalls: [], allGeneratedImages: [] });
const collect = async (stream: AsyncIterable<string>) => { let result = ''; for await (const text of stream) result += text; return result; };
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.clearAllMocks(); });
describe('Puente de investigación sin bypass de autoridad', () => {
  it('navegador independiente selecciona transporte explícito sin invocar IPC', async () => {
    vi.stubGlobal('window', {}); expect(await requestNativeGrounding(input, new AbortController().signal)).toBeNull();
  });
  it.each([
    { appRuntime: {} }, { aiGrounding: {} }, { ipcRenderer: {} },
    { ipcRenderer: { invoke: vi.fn().mockRejectedValue(new Error('Unauthorized IPC channel')) } },
    { ipcRenderer: { invoke: vi.fn().mockRejectedValue(new Error('No handler registered')) } },
    { ipcRenderer: { invoke: vi.fn().mockResolvedValue(undefined) } },
    { ipcRenderer: { invoke: vi.fn().mockResolvedValue({ success: false, code: 'IPC_DENIED' }) } },
    { ipcRenderer: { invoke: vi.fn().mockResolvedValue({ success: true, payload: [] }) } },
  ])('Electron no pasa a HTTP tras puente incompleto o denegado: %#', async surface => {
    vi.stubGlobal('window', surface); const fetch = vi.spyOn(globalThis, 'fetch');
    await expect(requestNativeGrounding(input, new AbortController().signal)).rejects.toBeInstanceOf(GroundingBridgeError);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('una señal cancelada no genera trabajo ni cancelación espuria', async () => {
    const generate = vi.fn(), cancel = vi.fn(); vi.stubGlobal('window', { aiGrounding: { generate, cancel } });
    const controller = new AbortController(); controller.abort();
    await expect(requestNativeGrounding(input, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(generate).not.toHaveBeenCalled(); expect(cancel).not.toHaveBeenCalled();
  });
  it('conserva payload válido y genera identificador de cancelación propio', async () => {
    const generate = vi.fn().mockResolvedValue({ success: true, payload: { candidates: [] } });
    vi.stubGlobal('window', { aiGrounding: { generate, cancel: vi.fn() } });
    expect(await requestNativeGrounding(input, new AbortController().signal)).toEqual({ candidates: [] });
    expect(generate.mock.calls[0][0].requestId).toMatch(/^[a-zA-Z0-9_-]+$/);
  });
  it('fuentes inválidas o URLs fallidas no acreditan investigación', () => {
    expect(extractSources({ candidates: [{ groundingMetadata: { groundingChunks: [{ web: { uri: 'javascript:alert(1)' } }] }, urlContextMetadata: { urlMetadata: [{ retrievedUrl: 'https://example.invalid', urlRetrievalStatus: 'URL_RETRIEVAL_STATUS_ERROR' }] } }] })).toBeNull();
    expect(extractSources({ candidates: [{ groundingMetadata: { groundingChunks: { web: true } } }] })).toBeNull();
  });
  it('conserva fuentes camel/snake, snippet e índices originales', () => {
    const sources = extractSources({ candidates: [{ grounding_metadata: { grounding_chunks: [{ web: { uri: 'https://example.invalid/1', title: 'Fuente' } }], grounding_supports: [{ grounding_chunk_indices: [0], segment: { text: 'Extracto' } }] }, url_context_metadata: { url_metadata: [{ retrieved_url: 'https://example.invalid/2', url_retrieval_status: 'URL_RETRIEVAL_STATUS_SUCCESS' }] } }] });
    expect(sources).toHaveLength(2); expect(sources?.[0]).toMatchObject({ snippet: 'Extracto', title: 'Fuente' });
  });
  it('un chunk inválido no desplaza el índice del snippet válido', () => {
    expect(extractSources({ candidates: [{ groundingMetadata: { groundingChunks: [null, { web: { uri: 'https://example.invalid', title: 'Fuente' } }], groundingSupports: [{ groundingChunkIndices: [1], segment: { text: 'Extracto correcto' } }] } }] })?.[0].snippet).toBe('Extracto correcto');
  });
  it.each(['IPC_DENIED', 'BUSY', 'INVALID_PAYLOAD', 'CREDENTIAL_FAILED'])('el consumidor completo no reintenta ni abre HTTP tras %s', async code => {
    const generate = vi.fn().mockResolvedValue({ success: false, code }); vi.stubGlobal('window', { aiGrounding: { generate, cancel: vi.fn() } });
    const fetch = vi.spyOn(globalThis, 'fetch'); const result = await sendGroundedMessage(messageInput());
    expect(await collect(result.stream)).toBe(WEB_GROUNDING_FAILURE); expect(generate).toHaveBeenCalledOnce(); expect(fetch).not.toHaveBeenCalled();
    expect(getApiKeyWithCache).not.toHaveBeenCalled();
  });
  it('detiene el turno antes de reintentar tras revocación de sesión', async () => {
    let finish!: (value: unknown) => void;
    const generate = vi.fn(() => new Promise(resolve => { finish = resolve; }));
    vi.stubGlobal('window', { aiGrounding: { generate, cancel: vi.fn() } });
    const pending = sendGroundedMessage(messageInput());
    await vi.waitFor(() => expect(generate).toHaveBeenCalledOnce());
    const [onAuth] = vi.mocked(supabase.auth.onAuthStateChange).mock.calls[0];
    await onAuth('SIGNED_OUT', null);
    finish({ success: false, code: 'PROVIDER_FAILED' });
    const result = await pending;
    expect(result.cancelled).toBe(true);
    expect(generate).toHaveBeenCalledOnce();
    expect(getApiKeyWithCache).not.toHaveBeenCalled();
  });
  it('conserva fuentes/gráficas y rechaza imágenes inline con MIME ejecutable', async () => {
    const generate = vi.fn().mockResolvedValue({ success: true, payload: { candidates: [{ content: { parts: [
      { text: 'Respuesta verificada' }, { inline_data: { mime_type: 'image/png', data: 'aW1hZ2Vu' } },
      { inlineData: { mimeType: 'image/svg+xml', data: 'aW1hZ2Vu' } },
    ] }, groundingMetadata: { groundingChunks: [{ web: { uri: 'https://example.invalid', title: 'Fuente de prueba' } }] } }] } });
    vi.stubGlobal('window', { aiGrounding: { generate, cancel: vi.fn() } });
    const result = await sendGroundedMessage(messageInput());
    expect(await collect(result.stream)).toBe('Respuesta verificada'); expect(result.generatedImages).toEqual(['data:image/png;base64,aW1hZ2Vu']);
    expect(await result.sources).toMatchObject([{ uri: 'https://example.invalid' }]);
    expect(generate.mock.calls[0][0].body.tools).toContainEqual({ code_execution: {} });
    expect(generate.mock.calls[0][0]).not.toHaveProperty('apiKey');
    expect(getApiKeyWithCache).not.toHaveBeenCalled();
  });
});
