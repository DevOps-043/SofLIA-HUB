import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserWindow, desktopCapturer, type IpcMainInvokeEvent } from 'electron';
import { BrowserWindow as MockWindow } from '../../test/mocks/electron/windowing';
import { ipcMain } from '../../test/mocks/electron/app-ipc';
import { pickDisplayMediaSource } from '../integrated-browser/display-media-picker';
import { listDisplayMediaChoices, setDisplayMediaTabProvider } from '../integrated-browser/display-media-sources';
import { exposeDisplayMediaPickerApi } from '../preload/display-media-api';
import { createSafeIpc } from '../preload/safe-ipc';
import type { DisplayMediaPickerApi } from '../../src/shared/display-media';

const thumbnail = { isEmpty: () => false, toDataURL: () => 'data:image/png;base64,aGVsbG8=' };
const source = (id = 'screen:1:0', name = 'Pantalla 1') => ({ id, name, thumbnail, display_id: '1', appIcon: null }) as unknown as Electron.DesktopCapturerSource;
const fixtures: MockWindow[] = [];
function open(audioRequested = false, isRequestCurrent?: () => boolean) {
  const parent = new BrowserWindow();
  const pending = pickDisplayMediaSource({ parentWindow: parent, audioRequested, isRequestCurrent });
  const picker = MockWindow.instances[MockWindow.instances.length - 1];
  fixtures.push(picker);
  const event = { sender: picker.webContents, senderFrame: picker.webContents.mainFrame } as unknown as IpcMainInvokeEvent;
  return { parent, picker, event, pending };
}
function invoke(channel: string, event: IpcMainInvokeEvent, payload?: unknown) {
  return ipcMain._getHandler(channel)!(event, payload);
}
beforeEach(() => { vi.clearAllMocks(); vi.mocked(desktopCapturer.getSources).mockResolvedValue([source()]); });
afterEach(() => { fixtures.splice(0).forEach((picker) => picker.emit('closed')); vi.useRealTimers(); vi.unstubAllEnvs(); });

describe('selector propio de pantalla', () => {
  it('no entrega captura hasta confirmar una fuente enumerada y revalida al confirmar', async () => {
    const f = open();
    const result = await invoke('display-media:list', f.event);
    expect(result).toMatchObject({ success: true, snapshot: { audioAvailable: false, sources: [{ kind: 'screen', thumbnail: thumbnail.toDataURL() }] } });
    expect(desktopCapturer.getSources).toHaveBeenCalledWith(expect.objectContaining({ thumbnailSize: { width: 480, height: 270 }, fetchWindowIcons: true }));
    const finished = vi.fn(); void f.pending.then(finished);
    await Promise.resolve(); expect(finished).not.toHaveBeenCalled();
    expect(await invoke('display-media:select', f.event, { sourceId: 'screen:1:0', withSystemAudio: true })).toEqual({ success: true });
    expect(await f.pending).toMatchObject({ video: source(), withSystemAudio: false, choice: { preview: { name: 'Pantalla 1' } } });
    expect(desktopCapturer.getSources).toHaveBeenCalledTimes(2);
    expect(f.picker.destroy).toHaveBeenCalledOnce();
    expect(f.parent.listenerCount('closed')).toBe(0);
    expect(await invoke('display-media:list', f.event)).toMatchObject({ success: false });
  });
  it('habilita audio solo cuando se solicitó y se eligió explícitamente', async () => {
    const f = open(true); await invoke('display-media:list', f.event);
    await invoke('display-media:select', f.event, { sourceId: 'screen:1:0', withSystemAudio: true });
    expect((await f.pending)?.withSystemAudio).toBe(process.platform === 'win32');
  });
  it.each([null, {}, [], { sourceId: 'screen:1:0', withSystemAudio: 'sí' }, { sourceId: 'screen:1:0', withSystemAudio: false, extra: true }, { sourceId: 'window:inventada', withSystemAudio: false }])('rechaza payload inválido o fuente fuera del inventario: %j', async (payload) => {
    const f = open(); await invoke('display-media:list', f.event);
    expect(await invoke('display-media:select', f.event, payload)).toMatchObject({ success: false });
    expect(f.picker.destroy).not.toHaveBeenCalled();
  });
  it('rechaza otros renderers y subframes sin revelar miniaturas', async () => {
    const f = open();
    const wrongSender = { ...f.event, sender: f.parent.webContents } as IpcMainInvokeEvent;
    const subframe = { ...f.event, senderFrame: {} } as IpcMainInvokeEvent;
    for (const event of [wrongSender, subframe]) {
      expect(await invoke('display-media:list', event)).toMatchObject({ success: false });
      expect(await invoke('display-media:cancel', event)).toEqual({ success: false });
      expect(await invoke('display-media:select', event, { sourceId: 'screen:1:0', withSystemAudio: false })).toMatchObject({ success: false });
    }
    expect(desktopCapturer.getSources).not.toHaveBeenCalled();
  });
  it('rechaza una ventana que desapareció y permite actualizar', async () => {
    const f = open(); await invoke('display-media:list', f.event);
    vi.mocked(desktopCapturer.getSources).mockResolvedValueOnce([]);
    expect(await invoke('display-media:select', f.event, { sourceId: 'screen:1:0', withSystemAudio: false })).toMatchObject({ success: false, error: expect.stringContaining('ya no está disponible') });
    expect((await invoke('display-media:list', f.event)).success).toBe(true);
  });
  it('muestra un error recuperable sin filtrar el error nativo', async () => {
    const f = open(); vi.mocked(desktopCapturer.getSources).mockRejectedValueOnce(new Error('ruta/privada'));
    expect(await invoke('display-media:list', f.event)).toEqual({ success: false, error: expect.stringContaining('vuelve a intentar') });
    expect((await invoke('display-media:list', f.event)).success).toBe(true);
  });
  it.each(['cancel', 'escape', 'closed', 'parent', 'navigation', 'crash', 'timeout'])('libera la solicitud al cancelar por %s', async (mode) => {
    if (mode === 'timeout') vi.useFakeTimers();
    const f = open();
    if (mode === 'cancel') await invoke('display-media:cancel', f.event);
    if (mode === 'escape') f.picker.webContents.emit('before-input-event', { preventDefault: vi.fn() }, { type: 'keyDown', key: 'Escape' });
    if (mode === 'closed') f.picker.emit('closed');
    if (mode === 'parent') f.parent.emit('closed');
    if (mode === 'navigation') f.parent.webContents.emit('did-start-navigation', {}, 'https://otro', false, true);
    if (mode === 'crash') f.picker.webContents.emit('render-process-gone');
    if (mode === 'timeout') await vi.advanceTimersByTimeAsync(120_000);
    expect(await f.pending).toBeNull();
    expect(f.picker.destroy).toHaveBeenCalledOnce();
    expect(f.parent.listenerCount('closed')).toBe(0);
  });
  it('cancela si el documento solicitante cambia mientras se elige', async () => {
    let current = true; const f = open(false, () => current);
    await invoke('display-media:list', f.event); current = false;
    expect(await invoke('display-media:select', f.event, { sourceId: 'screen:1:0', withSystemAudio: false })).toMatchObject({ success: false });
    expect(await f.pending).toBeNull();
  });
  it('impide dos selectores simultáneos para el mismo padre', async () => {
    const f = open();
    expect(await pickDisplayMediaSource({ parentWindow: f.parent, audioRequested: false })).toBeNull();
    expect(f.picker.destroy).not.toHaveBeenCalled();
  });
  it('no confirma mientras una enumeración está pendiente y descarta una respuesta tras cerrar', async () => {
    const f = open(); let finish!: (sources: Electron.DesktopCapturerSource[]) => void;
    vi.mocked(desktopCapturer.getSources).mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    const loading = invoke('display-media:list', f.event);
    expect(await invoke('display-media:select', f.event, { sourceId: 'screen:1:0', withSystemAudio: false })).toMatchObject({ success: false });
    await invoke('display-media:cancel', f.event); finish([source()]);
    expect(await loading).toMatchObject({ success: false }); expect(await f.pending).toBeNull();
  });
  it('resuelve la ruta del selector en desarrollo', async () => {
    vi.stubEnv('VITE_DEV_SERVER_URL', 'http://localhost:5187/');
    const f = open(); expect(f.picker.loadURL).toHaveBeenCalledWith('http://localhost:5187/?view=display-media-picker');
    await invoke('display-media:cancel', f.event); await f.pending;
  });
});

describe('inventario de captura', () => {
  it('omite el selector mismo y limita el inventario', async () => {
    const parent = new BrowserWindow();
    vi.mocked(desktopCapturer.getSources).mockResolvedValue([source('window:picker:0'), ...Array.from({ length: 110 }, (_, i) => source(`window:${i}:0`))]);
    const choices = await listDisplayMediaChoices(parent, 'window:picker:0');
    expect(choices).toHaveLength(100); expect(choices.some((choice) => choice.preview.id === 'window:picker:0')).toBe(false);
  });
  it('captura solo una pestaña del proveedor actual y rechaza navegación o cambio de perfil', async () => {
    const parent = new BrowserWindow();
    const frame = {};
    let url = 'https://ejemplo.com';
    const contents = { isDestroyed: () => false, mainFrame: frame, getURL: () => url, capturePage: vi.fn(async () => ({ ...thumbnail, resize: () => thumbnail })) } as unknown as Electron.WebContents;
    let documentToken = 'inicial';
    setDisplayMediaTabProvider(parent, () => [{ id: 'uno', name: 'Documento', documentToken, contents }]);
    const choices = await listDisplayMediaChoices(parent); const choice = choices.find((item) => item.preview.kind === 'tab')!;
    expect(choice.preview.thumbnail).toBe(thumbnail.toDataURL()); expect(await choice.resolve()).toBe(frame);
    url = 'https://ejemplo.com/otro'; expect(await choice.resolve()).toBeNull();
    url = 'https://ejemplo.com'; documentToken = 'recarga'; expect(await choice.resolve()).toBeNull();
    documentToken = 'inicial'; setDisplayMediaTabProvider(parent, null); expect(await choice.resolve()).toBeNull();
  });
});

describe('contrato preload del selector', () => {
  it('expone solo las tres operaciones cerradas y pasa por la allowlist', async () => {
    const bridge = { exposeInMainWorld: vi.fn() };
    const raw = { invoke: vi.fn(async (channel: string, ...args: unknown[]) => { void channel; void args; return { success: true }; }), send: vi.fn(), on: vi.fn(), off: vi.fn(), removeAllListeners: vi.fn() };
    const safe = createSafeIpc(raw); exposeDisplayMediaPickerApi(bridge, safe);
    const api = bridge.exposeInMainWorld.mock.calls[0][1] as DisplayMediaPickerApi;
    expect(Object.keys(api)).toEqual(['list', 'select', 'cancel']);
    await api.list(); await api.select({ sourceId: 'screen:1:0', withSystemAudio: false }); await api.cancel();
    expect(raw.invoke.mock.calls.map((call) => call[0])).toEqual(['display-media:list', 'display-media:select', 'display-media:cancel']);
    expect(() => safe.safeInvoke('display-media:shell')).toThrow('Unauthorized');
  });
});
