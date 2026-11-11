import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import type { Response as ModelResponse } from 'openai/resources/responses/responses';
import { registerOpenAIRuntime } from '../openai-runtime';
import { authSourceFixture } from './helpers/auth-source.fixture';
import { resetAuthStateForTests, setAuthState } from '../main/auth-state';
import { exposeOpenAIRuntime } from '../preload/openai-runtime-api';
import { createSafeIpc } from '../preload/safe-ipc';
import { openNativeResponses } from '../../src/services/openai-chat/native-responses';
import type { OpenAIRuntimeApi } from '../../src/shared/openai-runtime';
import type { OpenAICaller, OpenAIProvider } from '../openai-runtime/types';

const ipc = ipcMain as unknown as { _clearHandlers(): void; _getHandler(channel: string): (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown> };
let hub: ReturnType<typeof authSourceFixture>;
let orb: ReturnType<typeof authSourceFixture>;
let windows: ReturnType<typeof authSourceFixture>[];
const provider = vi.fn<OpenAIProvider>();
const invoke = (name: string, args: unknown[] = [], event?: IpcMainInvokeEvent) => ipc._getHandler(`ai:openai-${name}`)(event ?? hub.event, ...args);
const modelResponse = () => ({ output_text: 'texto ficticio', usage: { total_tokens: 9 }, output: [] } as unknown as ModelResponse);
const bind = (caller: OpenAICaller) => ({ ...caller, key: async () => 'clave-ficticia-main' });
const open = async () => (await invoke('open')) as { success: true; scopeId: string };
beforeEach(() => {
  resetAuthStateForTests(); ipc._clearHandlers(); vi.clearAllMocks(); setAuthState({ authenticated: true, userId: 'usuario' });
  hub = authSourceFixture(); orb = authSourceFixture(); windows = [hub, orb]; provider.mockResolvedValue(modelResponse());
  registerOpenAIRuntime(() => windows.map(w => w.window), { bind, provider });
});
afterEach(() => { setAuthState({ authenticated: false, userId: null }); resetAuthStateForTests(); vi.unstubAllGlobals(); });
describe('Inferencia OpenAI en cuatro capas', () => {
  it('permite Hub/Orbe pero no otras fuentes', async () => { expect(await open()).toMatchObject({ success: true }); expect(await invoke('open', [], orb.event)).toMatchObject({ success: true }); expect(await invoke('open', [], authSourceFixture().event)).toMatchObject({ code: 'IPC_DENIED' }); });
  it('sin sesión no abre scope ni llama proveedor', async () => { setAuthState({ authenticated: false, userId: null }); expect(await invoke('open')).toMatchObject({ code: 'IPC_DENIED' }); expect(provider).not.toHaveBeenCalled(); });
  it('subframe y documento ajeno no abren scope', async () => { expect(await invoke('open', [], { ...hub.event, senderFrame: { ...hub.frame } } as unknown as IpcMainInvokeEvent)).toMatchObject({ code: 'IPC_DENIED' }); hub.frame.url = 'https://ajeno.invalid'; expect(await invoke('open')).toMatchObject({ code: 'IPC_DENIED' }); });
  it('misma ventana comparte scope sin acumular listeners por open', async () => { const first = await open(); const count = hub.sender.listenerCount('did-start-navigation'); for (let n = 0; n < 10; n++) expect(await open()).toEqual(first); expect(hub.sender.listenerCount('did-start-navigation')).toBe(count); });
  it('otro emisor no usa scope ajeno ni lo cancela', async () => { const opened = await open(); expect(await invoke('start', [opened.scopeId, 'uno', { model: 'gpt-6-luna', input: 'prueba' }, 0], orb.event)).toMatchObject({ code: 'IPC_DENIED' }); expect(provider).not.toHaveBeenCalled(); });
  it.each(['navegación', 'A/B/A', 'destrucción'] as const)('revoca scope por %s', async reason => {
    const first = await open();
    if (reason === 'navegación') hub.sender.emit('did-start-navigation', { isMainFrame: true });
    if (reason === 'A/B/A') { setAuthState({ authenticated: true, userId: 'otro' }); setAuthState({ authenticated: true, userId: 'usuario' }); }
    if (reason === 'destrucción') hub.destroy();
    expect(await invoke('start', [first.scopeId, 'uno', { model: 'gpt-6-luna', input: 'prueba' }, 0])).toMatchObject({ code: 'IPC_DENIED' }); expect(provider).not.toHaveBeenCalled();
  });
  it('revocación durante proveedor no publica dato tardío', async () => {
    const first = await open(); let finish!: (value: ModelResponse) => void; provider.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    await invoke('start', [first.scopeId, 'uno', { model: 'gpt-6-luna', input: 'prueba' }, 0]); const pending = invoke('pull', [first.scopeId, 'uno', 0]); await vi.waitFor(() => expect(provider).toHaveBeenCalledOnce());
    setAuthState({ authenticated: false, userId: null }); expect(await pending).toMatchObject({ success: false }); finish(modelResponse());
  });
  it.each(['gpt-6-luna', 'gpt-6.1-terra'])('wrapper/preload/allowlist/handler conservan modelo %s y respuesta sin claves', async (model) => {
    let api!: OpenAIRuntimeApi;
    const transport = vi.fn((channel: string, ...args: unknown[]) => ipc._getHandler(channel)(hub.event, ...args));
    const safe = createSafeIpc({ invoke: transport, send: vi.fn(), on: vi.fn(), off: vi.fn(), removeAllListeners: vi.fn() });
    exposeOpenAIRuntime({ exposeInMainWorld: (_name, value) => { api = value as OpenAIRuntimeApi; } }, safe);
    vi.stubGlobal('window', { openaiRuntime: api }); const client = await openNativeResponses();
    expect(await client.responses.create({ model, input: 'prueba', store: false, reasoning: { effort: 'xhigh' } }, { maxRetries: 0 }))
      .toMatchObject({ output_text: 'texto ficticio' });
    expect(provider.mock.calls[0]?.[1]).toMatchObject({ model, reasoning: { effort: 'xhigh' } });
    expect(provider).toHaveBeenCalledOnce(); expect(JSON.stringify(transport.mock.calls)).not.toContain('clave-ficticia-main'); expect(() => safe.safeInvoke('ai:openai-arbitrary-url')).toThrow();
  });
  it('Stop del wrapper cancela el proveedor bajo las cuatro capas', async () => {
    let api!: OpenAIRuntimeApi, finish!: (value: ModelResponse) => void;
    provider.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const transport = vi.fn((channel: string, ...args: unknown[]) => ipc._getHandler(channel)(hub.event, ...args));
    exposeOpenAIRuntime({ exposeInMainWorld: (_name, value) => { api = value as OpenAIRuntimeApi; } }, createSafeIpc({ invoke: transport, send: vi.fn(), on: vi.fn(), off: vi.fn(), removeAllListeners: vi.fn() }));
    vi.stubGlobal('window', { openaiRuntime: api }); const client = await openNativeResponses(), abort = new AbortController();
    const pending = client.responses.create({ model: 'gpt-6-luna', input: 'prueba' }, { signal: abort.signal }); const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    await vi.waitFor(() => expect(provider).toHaveBeenCalledOnce()); abort.abort(); await rejected;
    await vi.waitFor(() => expect(provider.mock.calls[0][2].aborted).toBe(true)); finish(modelResponse());
  });
  it('payloads y aridad inválidos no crean trabajos', async () => {
    const first = await open();
    expect(await invoke('open', ['extra'])).toMatchObject({ code: 'INVALID_PAYLOAD' });
    for (const body of [{ model: 'gpt-6-luna', input: 'prueba', apiKey: 'ficticia' }, { model: '../modelo', input: 'prueba' }]) expect(await invoke('start', [first.scopeId, 'uno', body, 0])).toMatchObject({ code: 'INVALID_PAYLOAD' });
    expect(await invoke('pull', [first.scopeId, 'uno', -1])).toMatchObject({ code: 'INVALID_PAYLOAD' }); expect(provider).not.toHaveBeenCalled();
  });
});
