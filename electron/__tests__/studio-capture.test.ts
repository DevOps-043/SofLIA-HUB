import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import { ipcMain } from '../../test/mocks/electron/app-ipc';
import { StudioCaptureService, MAX_STUDIO_CAPTURE_BINDINGS } from '../studio-capture/service';
import { configureStudioCapture, resolveStudioCapture } from '../studio-capture';
import { setAuthState } from '../main/auth-state';
import { pickDisplayMediaSource, type DisplayMediaSelection } from '../integrated-browser/display-media-picker';
import { exposeStudioCaptureApi } from '../preload/studio-capture-api';
import { createSafeIpc } from '../preload/safe-ipc';
import type { StudioCaptureApi } from '../../src/shared/studio-capture';
vi.mock('../integrated-browser/display-media-picker', () => ({ pickDisplayMediaSource: vi.fn() }));
const video = { id: 'window:1:0' } as Electron.DesktopCapturerSource;
const resolve = vi.fn(async (): Promise<Electron.DesktopCapturerSource | null> => video);
const selection: DisplayMediaSelection = { video, withSystemAudio: false, choice: { preview: { id: video.id, name: 'Documento', kind: 'window', thumbnail: 'data:image/png;base64,aA==', appIcon: null }, resolve } };
beforeEach(() => { vi.clearAllMocks(); resolve.mockResolvedValue(video); vi.mocked(pickDisplayMediaSource).mockResolvedValue(selection); });
describe('vínculos locales de fuentes', () => {
  it('conserva el vínculo y solo concede una vista local por activación', async () => {
    const service = new StudioCaptureService(new BrowserWindow()); const binding = (await service.choose(() => true))!;
    expect(binding.id).not.toBe(video.id); expect(binding.name).toBe('Documento');
    expect(await service.forRequest(true)).toEqual({ bound: false });
    await service.activate(binding.id, true);
    expect(await service.forRequest(true)).toEqual({ bound: true, selection: { video, withSystemAudio: false } });
    expect(await service.forRequest(true)).toEqual({ bound: false });
    expect((await service.forRequest(false)).bound).toBe(true);
    await service.activate(binding.id, true); expect((await service.forRequest(true)).bound).toBe(true);
    expect(pickDisplayMediaSource).toHaveBeenCalledTimes(1);
    expect(resolve).toHaveBeenCalledWith(true);
  });
  it('nunca elige otra fuente cuando desaparece la ligada ni acepta IDs inventados', async () => {
    const service = new StudioCaptureService(new BrowserWindow()); const binding = (await service.choose(() => true))!;
    await service.activate(binding.id, false); resolve.mockResolvedValue(null);
    expect(await service.forRequest(false)).toEqual({ bound: true, selection: null });
    await expect(service.activate(crypto.randomUUID(), true)).rejects.toThrow('no está disponible');
    expect(pickDisplayMediaSource).toHaveBeenCalledOnce();
  });
  it('descarta una elección tardía tras limpiar y rechaza elección simultánea', async () => {
    let finish!: (value: DisplayMediaSelection | null) => void;
    vi.mocked(pickDisplayMediaSource).mockReturnValueOnce(new Promise((done) => { finish = done; }));
    const service = new StudioCaptureService(new BrowserWindow()); const pending = service.choose(() => true);
    await expect(service.choose(() => true)).rejects.toThrow('selección'); service.clear(); finish(selection);
    expect(await pending).toBeNull();
    expect(await service.forRequest(false)).toEqual({ bound: false });
  });
  it('libera por ID y limita concesiones a escenas y edición', async () => {
    const service = new StudioCaptureService(new BrowserWindow()); const bindings = [];
    for (let i = 0; i < MAX_STUDIO_CAPTURE_BINDINGS; i++) bindings.push((await service.choose(() => true))!);
    await expect(service.choose(() => true)).rejects.toThrow('Quita una fuente');
    service.release(bindings[0].id); expect(await service.choose(() => true)).not.toBeNull();
    service.clear(); expect(await service.forRequest(false)).toEqual({ bound: false });
  });
  it('rechaza una activación que termina después de un cambio de contexto', async () => {
    const service = new StudioCaptureService(new BrowserWindow()); const binding = (await service.choose(() => true))!;
    let finish!: (value: Electron.DesktopCapturerSource | null) => void;
    resolve.mockReturnValueOnce(new Promise((done) => { finish = done; }));
    const pending = service.activate(binding.id, true); service.clear(); finish(video);
    await expect(pending).rejects.toThrow('no está disponible');
  });
});
describe('contratos y autorización de fuentes', () => {
  function fixture() {
    const parent = new BrowserWindow(); configureStudioCapture(parent);
    const event = { sender: parent.webContents, senderFrame: parent.webContents.mainFrame } as IpcMainInvokeEvent;
    return { parent, event };
  }
  const invoke = (channel: string, event: IpcMainInvokeEvent, ...args: unknown[]) => ipcMain._getHandler(channel)!(event, ...args);
  it('permite al frame principal autenticado y rechaza subframe, otro renderer y payload adicional', async () => {
    const { event } = fixture();
    for (const wrong of [{ ...event, senderFrame: {} }, { ...event, sender: new BrowserWindow().webContents }]) expect(await invoke('studio-capture:choose', wrong as IpcMainInvokeEvent)).toMatchObject({ success: false });
    expect(await invoke('studio-capture:choose', event, {})).toMatchObject({ success: false });
    expect(await invoke('studio-capture:activate', event, { bindingId: 'inventado', preview: true })).toMatchObject({ success: false });
    const result = await invoke('studio-capture:choose', event); expect(result.success).toBe(true);
    expect(await invoke('studio-capture:activate', event, { bindingId: result.binding.id, preview: true, extra: 1 })).toMatchObject({ success: false });
    expect(await invoke('studio-capture:activate', event, { bindingId: result.binding.id, preview: true })).toEqual({ success: true });
  });
  it.each(['actor', 'navigation', 'closed'])('limpia concesiones al cambiar %s', async (mode) => {
    const { parent, event } = fixture(); const result = await invoke('studio-capture:choose', event);
    await invoke('studio-capture:activate', event, { bindingId: result.binding.id, preview: false });
    if (mode === 'actor') setAuthState({ authenticated: false, userId: null });
    if (mode === 'navigation') parent.webContents.emit('did-start-navigation', {}, 'https://otro', false, true);
    if (mode === 'closed') parent.emit('closed');
    expect(await resolveStudioCapture(parent, false)).toEqual({ bound: false });
  });
  it('expone cuatro métodos tipados y allowlisted, sin primitiva de captura arbitraria', async () => {
    const bridge = { exposeInMainWorld: vi.fn() };
    const raw = { invoke: vi.fn(async (channel: string, ...args: unknown[]) => { void channel; void args; return { success: true }; }), send: vi.fn(), on: vi.fn(), off: vi.fn(), removeAllListeners: vi.fn() };
    exposeStudioCaptureApi(bridge, createSafeIpc(raw)); const api = bridge.exposeInMainWorld.mock.calls[0][1] as StudioCaptureApi;
    await api.choose(); await api.activate({ bindingId: null, preview: false }); await api.release({ bindingId: crypto.randomUUID() }); await api.clear();
    expect(raw.invoke.mock.calls.map((call) => call[0])).toEqual(['studio-capture:choose', 'studio-capture:activate', 'studio-capture:release', 'studio-capture:clear']);
  });
});
