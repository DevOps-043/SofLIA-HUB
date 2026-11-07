import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import { registerFlowInferenceHandler } from '../flow-inference';
import { authSourceFixture } from './helpers/auth-source.fixture';
import { resetAuthStateForTests, setAuthState } from '../main/auth-state';
import { createSafeIpc } from '../preload/safe-ipc';
import { exposeFlowInferenceApi } from '../preload/flow-inference-api';
import { generateNativeFlow } from '../../src/services/flow-service/native';
import type { NativeFlowApi, NativeFlowRequest } from '../../src/shared/native-flow';
import type { OpenAICaller } from '../openai-runtime/types';
const ipc = ipcMain as unknown as { _clearHandlers(): void; _getHandler(channel: string): (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<Record<string, unknown>> };
let hub: ReturnType<typeof authSourceFixture>, orb: ReturnType<typeof authSourceFixture>;
const provider = vi.fn<(key: string, request: NativeFlowRequest, signal: AbortSignal) => Promise<string>>();
const bind = (caller: OpenAICaller) => ({ ...caller, key: async () => 'clave-ficticia-exclusiva-main' });
const invoke = (input: unknown, event?: IpcMainInvokeEvent) => ipc._getHandler('ai:flow-inference')(event ?? hub.event, input);
beforeEach(() => { resetAuthStateForTests(); ipc._clearHandlers(); vi.clearAllMocks(); setAuthState({ authenticated: true, userId: 'usuario' }); hub = authSourceFixture(); orb = authSourceFixture(); provider.mockResolvedValue('respuesta ficticia'); registerFlowInferenceHandler(() => [hub.window, orb.window], { bind, provider }); });
afterEach(() => { setAuthState({ authenticated: false, userId: null }); resetAuthStateForTests(); vi.unstubAllGlobals(); });
describe('Flow nativo en cuatro capas', () => {
  it.each([{ kind: 'analysis', text: 'prueba' }, { kind: 'fallback', text: 'prueba', image: 'QUJD' }, { kind: 'transcription', audio: 'QUJD', mimeType: 'audio/webm' }] as const)('wrapper y preload ejecutan $kind sin transmitir clave', async request => {
    let api!: NativeFlowApi; const transport = vi.fn((channel: string, ...args: unknown[]) => ipc._getHandler(channel)(hub.event, ...args));
    const safe = createSafeIpc({ invoke: transport, send: vi.fn(), on: vi.fn(), off: vi.fn(), removeAllListeners: vi.fn() });
    exposeFlowInferenceApi({ exposeInMainWorld: (_name, value) => { api = value as NativeFlowApi; } }, safe); vi.stubGlobal('window', { flowInference: api });
    expect(await generateNativeFlow(request)).toBe('respuesta ficticia'); expect(provider).toHaveBeenCalledOnce(); expect(JSON.stringify(transport.mock.calls)).not.toContain('clave-ficticia');
    const log = vi.spyOn(console, 'error').mockImplementation(() => {}); expect(() => safe.safeInvoke('ai:flow-inference-url')).toThrow(); log.mockRestore();
  });
  it.each([{ kind: 'analysis', text: 'x', model: 'otro' }, { kind: 'analysis', text: '' }, { kind: 'fallback', text: 'x', image: '../ruta' }, { kind: 'transcription', audio: 'QUJD', mimeType: 'text/html' }, { kind: 'analysis', text: 'x'.repeat(100001) }])('rechaza payload inválido %#', async request => { expect(await invoke(request)).toMatchObject({ success: false }); expect(provider).not.toHaveBeenCalled(); });
  it('deniega emisor ajeno y sesión ausente', async () => { expect(await invoke({ kind: 'analysis', text: 'x' }, authSourceFixture().event)).toMatchObject({ success: false }); setAuthState({ authenticated: false, userId: null }); expect(await invoke({ kind: 'analysis', text: 'x' })).toMatchObject({ success: false }); expect(provider).not.toHaveBeenCalled(); });
  it('revoca un resultado tardío', async () => {
    let finish!: (text: string) => void; provider.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const pending = invoke({ kind: 'analysis', text: 'x' }); await vi.waitFor(() => expect(provider).toHaveBeenCalledOnce());
    setAuthState({ authenticated: false, userId: null }); expect(await pending).toMatchObject({ success: false, code: 'revoked' }); finish('dato anterior');
  });
  it('retiene las plazas hasta terminar las llamadas físicas', async () => {
    const release: Array<(text: string) => void> = []; provider.mockImplementation(() => new Promise(resolve => release.push(resolve)));
    const jobs = Array.from({ length: 4 }, () => invoke({ kind: 'analysis', text: 'x' })); await vi.waitFor(() => expect(provider).toHaveBeenCalledTimes(4));
    expect(await invoke({ kind: 'analysis', text: 'x' })).toMatchObject({ success: false }); setAuthState({ authenticated: false, userId: null }); await Promise.all(jobs);
    setAuthState({ authenticated: true, userId: 'usuario' }); expect(await invoke({ kind: 'analysis', text: 'x' })).toMatchObject({ success: false }); release.forEach(done => done('ok'));
  });
});
