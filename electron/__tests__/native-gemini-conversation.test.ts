import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import { registerGeminiConversation } from '../gemini-conversation';
import { generateGeminiConversation, type GeminiConversationProvider, type GeminiProviderResult } from '../gemini-conversation/provider';
import { resetAuthStateForTests, setAuthState } from '../main/auth-state';
import { exposeGeminiConversation } from '../preload/gemini-conversation-api';
import { createSafeIpc } from '../preload/safe-ipc';
import { GEMINI_CONVERSATION_CHANNEL, GEMINI_IDLE_TIMEOUT_MS, type NativeGeminiConversationApi, type NativeGeminiReply } from '../../src/shared/native-gemini-conversation';
import { authSourceFixture } from './helpers/auth-source.fixture';

const ipc = ipcMain as unknown as { _clearHandlers(): void; _getHandler(channel: string): (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<NativeGeminiReply> };
const nativeKey = 'credencial-ficticia-de-conversacion';
const key = vi.fn(async () => nativeKey);
let hub: ReturnType<typeof authSourceFixture>;
let orb: ReturnType<typeof authSourceFixture>;
function register(provider: GeminiConversationProvider) {
  registerGeminiConversation(() => [hub.window, orb.window], { provider, bind: caller => ({ ...caller, key }) });
}
const openRequest = () => ({
  operation: 'open' as const,
  model: 'gemini-3.8-flash',
  config: { systemInstruction: 'Prueba', maxOutputTokens: 1024 },
  history: [],
});
const invoke = (request: unknown, event = hub.event) => ipc._getHandler(GEMINI_CONVERSATION_CHANNEL)(event, request);
async function open(): Promise<string> {
  const reply = await invoke(openRequest());
  if (!reply.success || !('turnId' in reply)) throw new Error('No se abrió el turno ficticio.');
  return reply.turnId;
}
const send = (id: string) => ({ operation: 'send', turnId: id, message: 'Mensaje' });
const close = (id: string) => ({ operation: 'close', turnId: id });

beforeEach(() => {
  resetAuthStateForTests();
  setAuthState({ authenticated: true, userId: 'actor-ficticio' });
  ipc._clearHandlers();
  key.mockClear();
  hub = authSourceFixture();
  orb = authSourceFixture();
});
afterEach(() => {
  setAuthState({ authenticated: false, userId: null });
  resetAuthStateForTests();
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe('Conversación Gemini en main', () => {
  it('recorre preload, allowlist, handler y SDK real con dos mensajes y firma de herramienta', async () => {
    vi.stubEnv('GOOGLE_GEMINI_BASE_URL', 'https://destino-ficticio.invalid');
    vi.stubEnv('GOOGLE_GENAI_USE_VERTEXAI', 'true');
    register(generateGeminiConversation);
    const fetch = vi.spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('Transporte ficticio agotado.'))
      .mockResolvedValueOnce(new Response(JSON.stringify({ candidates: [{ content: { role: 'model', parts: [
        { functionCall: { name: 'consultar', args: { dato: 1 } }, thoughtSignature: 'YQ==' },
      ] }, finishReason: 'STOP' }] }), { headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ candidates: [{ content: { role: 'model', parts: [{ text: 'Consulta completada' }] }, finishReason: 'STOP' }] }), { headers: { 'content-type': 'application/json' } }));
    let bridge!: NativeGeminiConversationApi;
    const transport = vi.fn((channel: string, ...args: unknown[]) => ipc._getHandler(channel)(hub.event, ...args));
    const safeIpc = createSafeIpc({ invoke: transport, send: vi.fn(), on: vi.fn(), off: vi.fn(), removeAllListeners: vi.fn() });
    exposeGeminiConversation({ exposeInMainWorld: (_name, value) => { bridge = value as NativeGeminiConversationApi; } }, safeIpc);
    const setup = openRequest();
    const opened = await bridge.request({ ...setup, config: { ...setup.config, tools: [{ functionDeclarations: [{ name: 'consultar' }] }] }, history: [
      { role: 'user', parts: [{ text: 'Pregunta anterior' }] }, { role: 'model', parts: [{ text: 'Respuesta anterior' }] },
    ] });
    if (!opened.success || !('turnId' in opened)) throw new Error('No se abrió el turno ficticio.');
    const first = await bridge.request({ operation: 'send', turnId: opened.turnId, message: 'Consulta el dato' });
    expect(first).toMatchObject({ success: true, response: { candidates: [{ content: { parts: [{ functionCall: { name: 'consultar' } }] } }] } });
    const next = await bridge.request({ operation: 'send', turnId: opened.turnId, message: [{ functionResponse: { name: 'consultar', response: { resultado: 7 } } }] });
    expect(next).toMatchObject({ success: true, response: { text: 'Consulta completada' } });
    expect(String(fetch.mock.calls[0][0])).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent');
    const http = fetch.mock.calls[1][1];
    expect(new Headers(http?.headers).get('x-goog-api-key')).toBe(nativeKey);
    expect(JSON.parse(String(http?.body)).contents).toMatchObject([
      { role: 'user', parts: [{ text: 'Pregunta anterior' }] },
      { role: 'model', parts: [{ text: 'Respuesta anterior' }] },
      { role: 'user', parts: [{ text: 'Consulta el dato' }] },
      { role: 'model', parts: [{ functionCall: { name: 'consultar' }, thoughtSignature: 'YQ==' }] },
      { role: 'user', parts: [{ functionResponse: { name: 'consultar', response: { resultado: 7 } } }] },
    ]);
    expect(key).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(transport.mock.calls)).not.toContain(nativeKey);
    await bridge.request({ operation: 'close', turnId: opened.turnId });
  });

  it('rechaza credenciales, transporte, configuraciones y fuentes fuera del contrato', async () => {
    const provider = vi.fn<GeminiConversationProvider>();
    register(provider);
    const setup = openRequest();
    for (const request of [
      { ...setup, apiKey: nativeKey },
      { ...setup, config: { httpOptions: { baseUrl: 'https://destino.invalid' } } },
      { ...setup, config: { mediaResolution: ['MEDIA_RESOLUTION_HIGH'] } },
      { ...setup, model: '../destino' },
    ]) expect(await invoke(request)).toMatchObject({ success: false, code: 'INVALID_PAYLOAD' });
    const id = await open();
    expect(await invoke({ ...send(id), message: [{ fileData: { fileUri: 'file:///ficticio', mimeType: 'video/mp4' } }] })).toMatchObject({ code: 'INVALID_PAYLOAD' });
    expect(await invoke(send(id), orb.event)).toMatchObject({ code: 'REVOKED' });
    expect(await invoke(close(id), orb.event)).toMatchObject({ code: 'REVOKED' });
    expect(await invoke(setup, authSourceFixture().event)).toMatchObject({ code: 'REVOKED' });
    expect(key).not.toHaveBeenCalled();
    expect(provider).not.toHaveBeenCalled();
  });

  it('retiene cuatro plazas físicas después de cerrar turnos', async () => {
    const finish: Array<(value: GeminiProviderResult) => void> = [];
    const provider = vi.fn<GeminiConversationProvider>(() => new Promise(resolve => { finish.push(resolve); }));
    register(provider);
    const ids = await Promise.all(Array.from({ length: 4 }, open));
    const pending = ids.map(id => invoke(send(id)));
    await vi.waitFor(() => expect(provider).toHaveBeenCalledTimes(4));
    await Promise.all(ids.map(id => invoke(close(id))));
    expect(await Promise.all(pending)).toEqual(ids.map(() => ({ success: false, code: 'REVOKED' })));
    const next = await open();
    expect(await invoke(send(next))).toMatchObject({ code: 'BUSY' });
    finish.forEach(resolve => resolve({ response: { text: 'Respuesta tardía' }, history: [] }));
    provider.mockResolvedValue({ response: { text: 'Nuevo turno' }, history: [] });
    await vi.waitFor(async () => expect(await invoke(send(next))).toMatchObject({ success: true, response: { text: 'Nuevo turno' } }));
  });

  it('el timeout físico no incorpora historial tardío al siguiente mensaje', async () => {
    const timeout = new AbortController();
    vi.spyOn(AbortSignal, 'timeout').mockReturnValueOnce(timeout.signal);
    let finish!: (value: GeminiProviderResult) => void;
    const provider = vi.fn<GeminiConversationProvider>().mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    provider.mockResolvedValue({ response: { text: 'Vigente' }, history: [] });
    register(provider);
    const id = await open();
    const pending = invoke(send(id));
    await vi.waitFor(() => expect(provider).toHaveBeenCalledOnce());
    timeout.abort();
    expect(await pending).toMatchObject({ code: 'TIMEOUT' });
    expect(await invoke(send(id))).toMatchObject({ code: 'BUSY' });
    finish({ response: { text: 'Tardío' }, history: [{ role: 'model', parts: [{ text: 'Tardío' }] }] });
    await vi.waitFor(async () => expect(await invoke(send(id))).toMatchObject({ success: true }));
    expect(provider.mock.calls[1][1].history).toEqual([]);
  });

  it('retira turnos inactivos y vuelve a admitir trabajo', async () => {
    vi.useFakeTimers();
    const provider = vi.fn<GeminiConversationProvider>();
    register(provider);
    const ids = await Promise.all(Array.from({ length: 4 }, open));
    expect(await invoke(openRequest())).toMatchObject({ code: 'BUSY' });
    await vi.advanceTimersByTimeAsync(GEMINI_IDLE_TIMEOUT_MS);
    expect(await invoke(send(ids[0]))).toMatchObject({ code: 'REVOKED' });
    expect(await invoke(openRequest())).toMatchObject({ success: true });
    expect(provider).not.toHaveBeenCalled();
  });

  it('A/B/A revoca una consulta de credenciales pendiente antes de inferencia', async () => {
    let finishKey!: (value: string) => void;
    key.mockImplementationOnce(() => new Promise(resolve => { finishKey = resolve; }));
    const provider = vi.fn<GeminiConversationProvider>();
    register(provider);
    const id = await open();
    const pending = invoke(send(id));
    await vi.waitFor(() => expect(key).toHaveBeenCalledOnce());
    setAuthState({ authenticated: true, userId: 'otro' });
    setAuthState({ authenticated: true, userId: 'actor-ficticio' });
    expect(await pending).toMatchObject({ code: 'REVOKED' });
    finishKey(nativeKey);
    expect(await invoke(send(id))).toMatchObject({ code: 'REVOKED' });
    expect(provider).not.toHaveBeenCalled();
  });
});
