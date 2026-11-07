import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import { registerAiGroundingHandler } from '../ai-grounding-handler';
import { authSourceFixture } from './helpers/auth-source.fixture';
import { resetAuthStateForTests, setAuthState } from '../main/auth-state';
import { exposeGroundingApi } from '../preload/grounding-api';
import { createSafeIpc } from '../preload/safe-ipc';
import { requestNativeGrounding } from '../../src/services/grounded-generation';
import type { GroundedGenerationApi } from '../../src/shared/grounded-generation';
const ipc = ipcMain as unknown as { _clearHandlers(): void; _getHandler(channel: string): (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown> };
let hub: ReturnType<typeof authSourceFixture>;
let windows: ReturnType<typeof authSourceFixture>[];
const nativeKey = 'credencial-ficticia-larga-para-tests';
const key = vi.fn<(signal?: AbortSignal) => Promise<string>>();
const payload = () => ({ requestId: 'request-1', modelName: 'gemini-3-test', body: { contents: [{ role: 'user', parts: [{ text: 'Consulta ficticia' }] }], tools: [{ google_search: {} }] } });
const invoke = (input: unknown, event?: IpcMainInvokeEvent) => ipc._getHandler('ai:generate-grounded')(event ?? hub.event, input);
beforeEach(() => {
  resetAuthStateForTests(); ipc._clearHandlers(); setAuthState({ authenticated: true, userId: 'usuario-qa' });
  hub = authSourceFixture(); windows = [hub];
  key.mockReset().mockResolvedValue(nativeKey);
  registerAiGroundingHandler(() => windows[0]?.window ?? null, () => windows[1]?.window ?? null, caller => ({ ...caller, key }));
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{"candidates":[]}'));
});
afterEach(() => { setAuthState({ authenticated: false, userId: null }); resetAuthStateForTests(); vi.restoreAllMocks(); vi.useRealTimers(); vi.unstubAllGlobals(); });
describe('Generación con fuentes bajo autoridad nativa', () => {
  it('sin sesión no envía la clave ni contexto', async () => {
    resetAuthStateForTests(); await invoke(payload()); expect(fetch).not.toHaveBeenCalled();
  });
  it('ventana ajena no admite generación', async () => {
    await invoke(payload(), authSourceFixture().event); expect(fetch).not.toHaveBeenCalled();
  });
  it('subframe no admite generación', async () => {
    await invoke(payload(), { ...hub.event, senderFrame: { ...hub.frame } } as unknown as IpcMainInvokeEvent); expect(fetch).not.toHaveBeenCalled();
  });
  it('navegar durante fetch no publica respuesta tardía', async () => {
    vi.mocked(fetch).mockImplementationOnce(async () => { hub.sender.emit('did-start-navigation', { isMainFrame: true }); return new Response('{"dato":"privado-ficticio"}'); });
    expect(await invoke(payload())).toMatchObject({ success: false });
  });
  it('conserva code_execution que el renderer ya solicita para Gemini 3', async () => {
    const input = { ...payload(), body: { ...payload().body, tools: [{ google_search: {} }, { code_execution: {} }] } };
    expect(await invoke(input)).toMatchObject({ success: true });
    expect(fetch).toHaveBeenCalledOnce();
    expect(vi.mocked(fetch).mock.calls[0][1]?.headers).toMatchObject({ 'x-goog-api-key': nativeKey });
  });
  it('errores del proveedor nunca reflejan la clave ni mensaje privado', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{"error":{"message":"credencial-ficticia-larga-para-tests texto-privado"}}', { status: 403 }));
    const result = await invoke(payload()); expect(JSON.stringify(result)).not.toContain('credencial-ficticia'); expect(JSON.stringify(result)).not.toContain('texto-privado');
  });
  it('documento ajeno no admite generación', async () => {
    hub.frame.url = 'https://ajeno.invalid'; await invoke(payload()); expect(fetch).not.toHaveBeenCalled();
  });
  it.each(['sesión', 'A/B/A', 'destrucción'] as const)('invalida respuesta durante fetch: %s', async reason => {
    vi.mocked(fetch).mockImplementationOnce(async () => {
      if (reason === 'sesión') setAuthState({ authenticated: false, userId: null });
      if (reason === 'A/B/A') { setAuthState({ authenticated: true, userId: 'otro' }); setAuthState({ authenticated: true, userId: 'usuario-qa' }); }
      if (reason === 'destrucción') hub.destroy();
      return new Response('{"dato":"privado-ficticio"}');
    });
    expect(await invoke(payload())).toMatchObject({ success: false });
  });
  it.each([
    { ...payload(), modelName: '../ajeno' }, { ...payload(), apiKey: nativeKey }, { ...payload(), extra: true },
    { ...payload(), body: { ...payload().body, tools: [{ functionDeclarations: [] }] } },
    { ...payload(), modelName: 'gemini-2-test', body: { ...payload().body, tools: [{ code_execution: {} }] } },
    { ...payload(), body: { ...payload().body, tools: [{ google_search: { campo: true } }] } },
    { ...payload(), body: { ...payload().body, tools: [{ google_search: {} }, { google_search: {} }] } },
    { ...payload(), body: { ...payload().body, contents: [{ text: '😀'.repeat(80000) }] } },
  ])('rechaza datos/herramientas/cuotas inválidos: %#', async value => {
    expect(await invoke(value)).toMatchObject({ success: false, code: 'INVALID_PAYLOAD' }); expect(fetch).not.toHaveBeenCalled(); expect(key).not.toHaveBeenCalled();
  });
  it('rechaza getters sin evaluarlos', async () => {
    const getter = vi.fn(() => 'gemini-3-test');
    const input = Object.defineProperty({ ...payload() }, 'modelName', { enumerable: true, get: getter });
    expect(await invoke(input)).toMatchObject({ success: false }); expect(getter).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
  });
  it('Stop recorre wrapper/preload/allowlist/handler y aborta HTTP', async () => {
    let release!: (value: Response) => void;
    vi.mocked(fetch).mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    let api: GroundedGenerationApi | undefined;
    const transport = vi.fn((channel: string, ...args: unknown[]) => ipc._getHandler(channel)(hub.event, ...args));
    const safe = createSafeIpc({ invoke: transport, send: vi.fn(), on: vi.fn(), off: vi.fn(), removeAllListeners: vi.fn() });
    exposeGroundingApi({ exposeInMainWorld: (_name, value) => { api = value as GroundedGenerationApi; } }, safe);
    vi.stubGlobal('window', { aiGrounding: api }); const controller = new AbortController();
    const pending = requestNativeGrounding(payload(), controller.signal); const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce()); controller.abort(); await rejected;
    await vi.waitFor(() => expect(vi.mocked(fetch).mock.calls[0][1]?.signal?.aborted).toBe(true));
    expect(transport.mock.calls[0][1]).not.toHaveProperty('apiKey');
    expect(transport.mock.calls[1][0]).toBe('ai:cancel-grounded');
    release(new Response('{}')); for (let index = 0; index < 12; index++) await Promise.resolve();
    expect(() => safe.safeInvoke('ai:execute-arbitrary')).toThrow();
  });
  it('otra ventana no cancela el trabajo y la plaza permanece tras cancelar hasta cerrar transporte', async () => {
    const orb = authSourceFixture(); windows.push(orb);
    let release!: (value: Response) => void;
    vi.mocked(fetch).mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    const pending = invoke(payload()); await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    expect(await ipc._getHandler('ai:cancel-grounded')(orb.event, 'request-1')).toEqual({ success: false });
    expect(await invoke({ ...payload(), requestId: 'request-2' })).toMatchObject({ code: 'BUSY' });
    expect(await ipc._getHandler('ai:cancel-grounded')(hub.event, 'request-1')).toEqual({ success: true });
    expect(await pending).toMatchObject({ code: 'CANCELLED' });
    expect(await invoke({ ...payload(), requestId: 'request-3' })).toMatchObject({ code: 'BUSY' });
    release(new Response('{}')); for (let index = 0; index < 12; index++) await Promise.resolve();
  });
  it('retiene la plaza al cancelar durante la consulta física de clave', async () => {
    let resolveKey!: (value: string) => void;
    key.mockImplementationOnce(() => new Promise(resolve => { resolveKey = resolve; }));
    const pending = invoke(payload());
    await vi.waitFor(() => expect(key).toHaveBeenCalledOnce());
    expect(await ipc._getHandler('ai:cancel-grounded')(hub.event, 'request-1')).toEqual({ success: true });
    expect(await pending).toMatchObject({ code: 'CANCELLED' });
    expect(key.mock.calls[0][0]?.aborted).toBe(true);
    expect(await invoke(payload())).toMatchObject({ code: 'BUSY' });
    expect(key).toHaveBeenCalledOnce();
    resolveKey(nativeKey);
    await vi.waitFor(async () => expect(await invoke(payload())).toMatchObject({ success: true }));
    expect(fetch).toHaveBeenCalledOnce();
  });
  it('descarta la clave tardía después de un cambio A/B/A', async () => {
    let resolveKey!: (value: string) => void;
    key.mockImplementationOnce(() => new Promise(resolve => { resolveKey = resolve; }));
    const pending = invoke(payload());
    await vi.waitFor(() => expect(key).toHaveBeenCalledOnce());
    setAuthState({ authenticated: true, userId: 'otro' });
    setAuthState({ authenticated: true, userId: 'usuario-qa' });
    expect(await pending).toMatchObject({ code: 'CANCELLED' });
    resolveKey(nativeKey);
    await vi.waitFor(async () => expect(await invoke(payload())).toMatchObject({ success: true }));
    expect(fetch).toHaveBeenCalledOnce();
  });
  it('un fallo de consulta tiene código fijo y evita HTTP', async () => {
    key.mockRejectedValueOnce(new Error('credencial-ficticia-privada'));
    const result = await invoke(payload());
    expect(result).toMatchObject({ success: false, code: 'CREDENTIAL_FAILED' });
    expect(JSON.stringify(result)).not.toContain('credencial-ficticia-privada');
    expect(fetch).not.toHaveBeenCalled();
  });
  it('deadline 150 s aborta aunque fetch ignore señal, sin cola nueva', async () => {
    vi.useFakeTimers(); let release!: (value: Response) => void;
    vi.mocked(fetch).mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    const pending = invoke(payload()); await vi.advanceTimersByTimeAsync(150001);
    expect(await pending).toMatchObject({ code: 'CANCELLED' });
    expect(vi.mocked(fetch).mock.calls[0][1]?.signal?.aborted).toBe(true);
    expect(await invoke(payload())).toMatchObject({ code: 'BUSY' }); release(new Response('{}'));
    for (let index = 0; index < 12; index++) await Promise.resolve();
  });
});
