import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import { registerImageGenerationHandler } from '../image-generation';
import { authSourceFixture } from './helpers/auth-source.fixture';
import { resetAuthStateForTests, setAuthState } from '../main/auth-state';
import { exposeImageGenerationApi } from '../preload/image-generation-api';
import { createSafeIpc } from '../preload/safe-ipc';
import { generateNativeImage } from '../../src/services/image-generation-api';
import { IMAGE_MAX_PROMPT, type ImageGenerationApi } from '../../src/shared/image-generation';
import type { OpenAICaller } from '../openai-runtime/types';
const ipc = ipcMain as unknown as { _clearHandlers(): void; _getHandler(channel: string): (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<Record<string, unknown>> };
let hub: ReturnType<typeof authSourceFixture>, orb: ReturnType<typeof authSourceFixture>;
const provider = vi.fn<(key: string, prompt: string, signal: AbortSignal) => Promise<unknown>>();
const bind = (caller: OpenAICaller) => ({ ...caller, key: async () => 'clave-ficticia-exclusiva-main' });
const invoke = (args: unknown[] = ['solicitud ficticia'], event?: IpcMainInvokeEvent) => ipc._getHandler('ai:image-generation')(event ?? hub.event, ...args);
const response = () => ({ data: [{ b64_json: 'QUJD' }] });
beforeEach(() => { resetAuthStateForTests(); ipc._clearHandlers(); vi.clearAllMocks(); setAuthState({ authenticated: true, userId: 'usuario' }); hub = authSourceFixture(); orb = authSourceFixture(); provider.mockResolvedValue(response()); registerImageGenerationHandler(() => [hub.window, orb.window], { bind, provider }); });
afterEach(() => { setAuthState({ authenticated: false, userId: null }); resetAuthStateForTests(); vi.unstubAllGlobals(); });
describe('Imagen OpenAI en cuatro capas', () => {
  it('conecta wrapper, preload y main sin enviar la clave al renderer', async () => {
    let api!: ImageGenerationApi; const transport = vi.fn((channel: string, ...args: unknown[]) => ipc._getHandler(channel)(hub.event, ...args));
    const safe = createSafeIpc({ invoke: transport, send: vi.fn(), on: vi.fn(), off: vi.fn(), removeAllListeners: vi.fn() });
    exposeImageGenerationApi({ exposeInMainWorld: (_name, value) => { api = value as ImageGenerationApi; } }, safe); vi.stubGlobal('window', { imageGeneration: api });
    expect(await generateNativeImage('paisaje ficticio')).toMatchObject({ success: true, text: 'Aquí está tu imagen generada.', imageData: 'data:image/png;base64,QUJD' });
    expect(provider).toHaveBeenCalledOnce(); expect(JSON.stringify(transport.mock.calls)).not.toContain('clave-ficticia-exclusiva-main');
    const log = vi.spyOn(console, 'error').mockImplementation(() => {}); expect(() => safe.safeInvoke('ai:imagen-arbitraria')).toThrow(); log.mockRestore();
  });
  it('permite Orbe y deniega emisor o marco ajeno', async () => {
    expect(await invoke([], orb.event)).toMatchObject({ success: false });
    expect(await invoke(['prueba'], orb.event)).toMatchObject({ success: true });
    expect(await invoke(['prueba'], authSourceFixture().event)).toMatchObject({ success: false });
    expect(await invoke(['prueba'], { ...hub.event, senderFrame: { ...hub.frame } } as unknown as IpcMainInvokeEvent)).toMatchObject({ success: false });
    expect(provider).toHaveBeenCalledTimes(1);
  });
  it.each([[], [''], ['x'.repeat(IMAGE_MAX_PROMPT + 1)], [{ prompt: 'x' }], ['x', 'extra']])('rechaza entrada inválida sin consultar proveedor %#', async (...args) => { expect(await invoke(args)).toMatchObject({ success: false }); expect(provider).not.toHaveBeenCalled(); });
  it('deniega sesión ausente', async () => { setAuthState({ authenticated: false, userId: null }); expect(await invoke()).toMatchObject({ success: false }); expect(provider).not.toHaveBeenCalled(); });
  it.each(['sesión', 'navegación', 'destrucción'])('revoca resultado si cambia %s', async reason => {
    let finish!: (value: unknown) => void; provider.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const pending = invoke(); await vi.waitFor(() => expect(provider).toHaveBeenCalledOnce());
    if (reason === 'sesión') { setAuthState({ authenticated: false, userId: null }); setAuthState({ authenticated: true, userId: 'usuario' }); }
    if (reason === 'navegación') hub.sender.emit('did-start-navigation', {}, 'https://ajeno.invalid', false, true);
    if (reason === 'destrucción') hub.destroy();
    expect(await pending).toMatchObject({ success: false }); finish(response());
  });
  it('conserva plazas físicas hasta que el proveedor termina', async () => {
    const releases: Array<(value: unknown) => void> = []; provider.mockImplementation(() => new Promise(resolve => releases.push(resolve)));
    const jobs = Array.from({ length: 4 }, () => invoke()); await vi.waitFor(() => expect(provider).toHaveBeenCalledTimes(4));
    expect(await invoke()).toMatchObject({ success: false }); expect(provider).toHaveBeenCalledTimes(4);
    setAuthState({ authenticated: false, userId: null }); await Promise.all(jobs); setAuthState({ authenticated: true, userId: 'usuario' });
    expect(await invoke()).toMatchObject({ success: false }); releases.forEach(finish => finish(response()));
    await vi.waitFor(async () => { provider.mockResolvedValue(response()); expect(await invoke()).toMatchObject({ success: true }); });
  });
  it('revocar mientras se consulta la clave no inicia proveedor', async () => {
    let finish!: (key: string) => void;
    ipc._clearHandlers(); registerImageGenerationHandler(() => [hub.window, orb.window], { bind: caller => ({ ...caller, key: () => new Promise(resolve => { finish = resolve; }) }), provider });
    const pending = invoke(); await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
    setAuthState({ authenticated: false, userId: null }); expect(await pending).toMatchObject({ success: false });
    finish('clave-ficticia-exclusiva-main'); await Promise.resolve(); expect(provider).not.toHaveBeenCalled();
  });
  it('limita base64 y cantidad de imágenes', async () => {
    provider.mockResolvedValueOnce({ data: [{ b64_json: 'A'.repeat(16 * 1024 * 1024 + 4) }] });
    expect(await invoke()).toMatchObject({ success: false });
    provider.mockResolvedValueOnce({ data: [{ b64_json: 'QUJD' }, { b64_json: 'QUJD' }] });
    expect(await invoke()).toMatchObject({ success: false });
  });
  it('rechaza una respuesta con URL en lugar de imagen base64', async () => {
    provider.mockResolvedValue({ data: [{ url: 'https://destino.invalid' }] });
    expect(await invoke()).toMatchObject({ success: false });
  });
  it('no filtra detalles de fallos del proveedor', async () => { provider.mockRejectedValue(new Error('clave-ficticia-exclusiva-main')); const result = await invoke(); expect(JSON.stringify(result)).not.toContain('clave-ficticia'); expect(result).toMatchObject({ success: false }); });
});
