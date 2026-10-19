import { afterEach, describe, expect, it, vi } from 'vitest';
import { BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import { BrowserWindow as MockWindow } from '../../test/mocks/electron/windowing';
import { ipcMain } from '../../test/mocks/electron/app-ipc';
import { configureStudioOutput, resolveStudioOutput } from '../studio-output';
import { setAuthState } from '../main/auth-state';
import { exposeStudioOutputApi, exposeStudioOutputReceiverApi } from '../preload/studio-output-api';
import { createSafeIpc } from '../preload/safe-ipc';
import type { StudioOutputApi, StudioOutputReceiverApi } from '../../src/shared/studio-program';

const offer = { type: 'offer', sdp: 'v=0\r\nprueba' }, answer = { type: 'answer', sdp: 'v=0\r\nrespuesta' };
const eventFor = (window: BrowserWindow) => ({ sender: window.webContents, senderFrame: window.webContents.mainFrame }) as IpcMainInvokeEvent;
const invoke = (channel: string, event: IpcMainInvokeEvent, ...args: unknown[]) => ipcMain._getHandler(channel)!(event, ...args);
let parent: BrowserWindow;
afterEach(() => { parent?.emit('closed'); vi.useRealTimers(); });
function fixture() { parent = new BrowserWindow(); Object.assign(parent.webContents, { getBackgroundThrottling: vi.fn(() => true), setBackgroundThrottling: vi.fn() }); configureStudioOutput(parent); return eventFor(parent); }
function start() {
  const event = fixture(); const pending = invoke('studio-output:open', event, offer);
  const receiver = MockWindow.instances[MockWindow.instances.length - 1] as unknown as BrowserWindow;
  return { event, receiver, receiving: eventFor(receiver), pending };
}
describe('salida de programa aislada', () => {
  it('solo concede captura tras respuesta y primer frame del receptor exacto', async () => {
    const f = start(); const negotiation = await invoke('studio-output:offer', f.receiving);
    expect(negotiation.offer).toEqual(offer);
    expect(resolveStudioOutput(parent)).toEqual({ prepared: true, frame: null });
    expect(await invoke('studio-output:answer', f.event, { id: negotiation.id, answer })).toEqual({ success: false });
    expect(await invoke('studio-output:answer', f.receiving, { id: crypto.randomUUID(), answer })).toEqual({ success: false });
    expect(await invoke('studio-output:answer', f.receiving, { id: negotiation.id, answer })).toEqual({ success: true });
    expect(await f.pending).toEqual({ success: true, answer });
    await invoke('studio-output:state', f.receiving, { id: negotiation.id, state: 'ready' });
    expect(resolveStudioOutput(parent).frame).toBe(f.receiver.webContents.mainFrame);
    expect(f.receiver.show).not.toHaveBeenCalled();
    await invoke('studio-output:close', f.event);
    expect(resolveStudioOutput(parent)).toEqual({ prepared: false, frame: null });
    expect(f.receiver.destroy).toHaveBeenCalledOnce();
    expect(parent.webContents.setBackgroundThrottling).toHaveBeenLastCalledWith(true);
  });
  it('rechaza actor, subframe, payload excesivo y argumentos extra', async () => {
    const event = fixture();
    for (const wrong of [{ ...event, senderFrame: {} }, eventFor(new BrowserWindow())]) expect(await invoke('studio-output:open', wrong as IpcMainInvokeEvent, offer)).toMatchObject({ success: false });
    for (const payload of [{ ...offer, url: 'https://ajeno.test' }, { ...offer, sdp: 'x'.repeat(65537) }, { ...offer, type: 'answer' }]) expect(await invoke('studio-output:open', event, payload)).toMatchObject({ success: false });
    expect(await invoke('studio-output:open', event, offer, true)).toMatchObject({ success: false });
  });
  it.each(['cuenta', 'navegación', 'cierre', 'fallo', 'timeout'])('revoca negociación pendiente por %s', async (mode) => {
    if (mode === 'timeout') vi.useFakeTimers();
    const f = start(); const negotiation = await invoke('studio-output:offer', f.receiving);
    if (mode === 'cuenta') setAuthState({ authenticated: true, userId: 'otra-cuenta' });
    if (mode === 'navegación') parent.webContents.emit('did-start-navigation', {}, 'https://otra', false, true);
    if (mode === 'cierre') parent.emit('closed');
    if (mode === 'fallo') f.receiver.webContents.emit('render-process-gone');
    if (mode === 'timeout') await vi.advanceTimersByTimeAsync(25000);
    expect(await f.pending).toMatchObject({ success: false });
    expect(resolveStudioOutput(parent).prepared).toBe(false);
    expect(await invoke('studio-output:answer', f.receiving, { id: negotiation.id, answer })).toEqual({ success: false });
  });
  it('expone APIs separadas con canales allowlisted y sin transporte de archivos', async () => {
    const bridge = { exposeInMainWorld: vi.fn() };
    const raw = { invoke: vi.fn(async () => ({ success: true })), send: vi.fn(), on: vi.fn(), off: vi.fn(), removeAllListeners: vi.fn() };
    const ipc = createSafeIpc(raw); exposeStudioOutputApi(bridge, ipc); exposeStudioOutputReceiverApi(bridge, ipc);
    const publisher = bridge.exposeInMainWorld.mock.calls[0][1] as StudioOutputApi;
    const receiver = bridge.exposeInMainWorld.mock.calls[1][1] as StudioOutputReceiverApi;
    await publisher.open(offer as { type: 'offer'; sdp: string }); await publisher.close(); publisher.onState(vi.fn())();
    await receiver.offer(); await receiver.answer({ id: crypto.randomUUID(), answer: answer as { type: 'answer'; sdp: string } }); await receiver.state({ id: crypto.randomUUID(), state: 'ready' });
    expect(raw.invoke.mock.calls).toHaveLength(5); expect(raw.on).toHaveBeenCalledOnce(); expect(raw.off).toHaveBeenCalledOnce();
    expect(Object.keys(receiver)).toEqual(['offer', 'answer', 'state']);
  });
});
