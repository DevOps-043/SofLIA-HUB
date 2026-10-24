import { EventEmitter } from 'node:events';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { app, ipcMain, dialog, type BrowserWindow, type IpcMainInvokeEvent, type MessageBoxOptions } from 'electron';
import { setAuthState, resetAuthStateForTests } from '../main/auth-state';
import { registerGmailHandlers } from '../gmail-handlers';
import { IPC_APPROVAL_MS } from '../ipc/caller-authorization';
import { exposeGoogleApis } from '../preload/google-apis';
import { fixture, owner, plan, guard } from './gmail-plans/fixtures';

let root: string;
let fx: ReturnType<typeof fixture>;
let value: ReturnType<typeof plan>;
let sender: EventEmitter & { mainFrame: { url: string }; isDestroyed(): boolean };
let window: BrowserWindow;
let event: IpcMainInvokeEvent;
const harness = ipcMain as unknown as { _getHandler(channel: string): (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown> };
const invoke = (channel: string, ...args: unknown[]) => harness._getHandler(channel)(event, ...args);

beforeEach(async () => {
  vi.clearAllMocks(); resetAuthStateForTests(); setAuthState({ authenticated: true, userId: owner.userId });
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'soflia-plan-ipc-')); fx = fixture(root); value = plan();
  await fx.store.account(owner).save(value, guard);
  sender = Object.assign(new EventEmitter(), { isDestroyed: () => false, mainFrame: { url: pathToFileURL(path.join(app.getAppPath(), 'dist', 'index.html')).href } });
  window = { webContents: sender, isDestroyed: () => false } as unknown as BrowserWindow;
  event = { sender, senderFrame: sender.mainFrame } as unknown as IpcMainInvokeEvent;
  vi.mocked(dialog.showMessageBox).mockResolvedValue({ response: 1, checkboxChecked: false });
  registerGmailHandlers(fx.service, () => window);
});
afterEach(async () => { vi.restoreAllMocks(); vi.useRealTimers(); resetAuthStateForTests(); await fs.rm(root, { recursive: true, force: true }); });

describe('Tres canales de planes Gmail', () => {
  it.each(['gmail:preview-organization', 'gmail:apply-organization-plan', 'gmail:undo-organization-plan'])('rechaza un frame ajeno antes del cliente: %s', async channel => {
    event = { ...event, senderFrame: {} } as IpcMainInvokeEvent;
    expect(await invoke(channel, value.id)).toMatchObject({ success: false });
    expect(fx.acquire).not.toHaveBeenCalled(); expect(dialog.showMessageBox).not.toHaveBeenCalled();
    expect(sender.listenerCount('destroyed')).toBe(0);
  });
  it.each(['sesión', 'origen', 'ventana', 'dueño'])('rechaza contexto %s ajeno', async mode => {
    if (mode === 'sesión') setAuthState({ authenticated: false, userId: null });
    if (mode === 'origen') sender.mainFrame.url = 'https://externo.example.test/';
    if (mode === 'ventana') window = { ...window, isDestroyed: () => true } as unknown as BrowserWindow;
    if (mode === 'dueño') fx.calendar.connections.get('google')!.userId = 'otro';
    expect(await invoke('gmail:apply-organization-plan', value.id)).toMatchObject({ success: false });
    expect(fx.acquire).not.toHaveBeenCalled(); expect(dialog.showMessageBox).not.toHaveBeenCalled();
  });
  it.each([
    { channel: 'gmail:preview-organization', args: [{ maxMessages: 1001 }] },
    { channel: 'gmail:preview-organization', args: [{ extra: true }] },
    { channel: 'gmail:preview-organization', args: [null] },
    { channel: 'gmail:apply-organization-plan', args: ['../../privado'] },
    { channel: 'gmail:undo-organization-plan', args: [''] },
    { channel: 'gmail:apply-organization-plan', args: [] },
  ])('rechaza argumentos sin declararlos inciertos: %#', async ({ channel, args }) => {
    const response = await invoke(channel, ...args);
    expect(response).toMatchObject({ success: false }); expect(response).not.toHaveProperty('uncertain');
    expect(fx.acquire).not.toHaveBeenCalled(); expect(dialog.showMessageBox).not.toHaveBeenCalled();
  });
  it('confirma cuenta y plan exactos antes de aplicar o revertir', async () => {
    expect(await invoke('gmail:apply-organization-plan', value.id, { removeFromInbox: true })).toMatchObject({ success: true, messagesLabeled: 2 });
    expect(await invoke('gmail:undo-organization-plan', value.id)).toMatchObject({ success: true, messagesRestored: 2 });
    const calls = vi.mocked(dialog.showMessageBox).mock.calls as unknown as [BrowserWindow, MessageBoxOptions][];
    expect(calls).toHaveLength(2); expect(calls[0][0]).toBe(window);
    expect(calls[0][1]).toMatchObject({ defaultId: 0, cancelId: 0 });
    expect(calls[0][1].detail).toContain(owner.email); expect(calls[0][1].detail).toContain(value.id);
    expect(calls[0][1].detail).toContain('Empresa'); expect(calls[1][1].detail).toContain('Revertir');
    expect(sender.listenerCount('did-start-navigation')).toBe(0);
  });
  it('preview no muta Gmail ni requiere confirmación destructiva', async () => {
    expect(await invoke('gmail:preview-organization', { minGroupSize: 1 })).toMatchObject({ success: true, scannedMessages: 2 });
    expect(dialog.showMessageBox).not.toHaveBeenCalled(); expect(fx.batchModify).not.toHaveBeenCalled();
  });
  it('cancelar aplicar conserva el preview sin efectos', async () => {
    vi.mocked(dialog.showMessageBox).mockResolvedValueOnce({ response: 0, checkboxChecked: false });
    expect(await invoke('gmail:apply-organization-plan', value.id)).toMatchObject({ success: false, cancelled: true });
    expect(fx.batchModify).not.toHaveBeenCalled(); expect(fx.createLabel).not.toHaveBeenCalled();
  });
  it.each(['A/B/A', 'navegación', 'conexión'])('invalida la aceptación tras %s', async mode => {
    vi.mocked(dialog.showMessageBox).mockImplementationOnce(async () => {
      if (mode === 'A/B/A') { setAuthState({ authenticated: false, userId: null }); setAuthState({ authenticated: true, userId: owner.userId }); }
      if (mode === 'navegación') sender.emit('did-start-navigation', {}, sender.mainFrame.url, false, true);
      if (mode === 'conexión') fx.calendar.contextRevision++;
      return { response: 1, checkboxChecked: false };
    });
    expect(await invoke('gmail:apply-organization-plan', value.id)).toMatchObject({ success: false });
    expect(fx.createLabel).not.toHaveBeenCalled(); expect(sender.listenerCount('destroyed')).toBe(0);
  });
  it('una aceptación vencida no ejecuta el plan', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    let answer!: (value: { response: number; checkboxChecked: boolean }) => void;
    let shown!: () => void; const ready = new Promise<void>(resolve => { shown = resolve; });
    vi.mocked(dialog.showMessageBox).mockImplementationOnce(() => { shown(); return new Promise(resolve => { answer = resolve; }); });
    const pending = invoke('gmail:apply-organization-plan', value.id); await ready;
    await vi.advanceTimersByTimeAsync(IPC_APPROVAL_MS);
    expect(await pending).toMatchObject({ success: false });
    answer({ response: 1, checkboxChecked: false }); await Promise.resolve();
    expect(fx.createLabel).not.toHaveBeenCalled();
  });
  it('preload conserva argumentos y el resultado parcial', async () => {
    let bridge!: { applyOrganizationPlan(id: string, options?: { removeFromInbox?: boolean }): Promise<unknown>; undoOrganizationPlan(id?: string): Promise<unknown> };
    const response = { success: false, partial: true, uncertain: true, messagesLabeled: 100 };
    const transport = vi.fn(async () => response);
    exposeGoogleApis({ exposeInMainWorld: (name, object) => { if (name === 'gmail') bridge = object as typeof bridge; } }, {
      safeInvoke: transport, safeSend: vi.fn(), safeOn: vi.fn(() => vi.fn()), safeRemoveAllListeners: vi.fn(), sanitizePayload: object => object, validateChannel: vi.fn(),
    });
    expect(await bridge.applyOrganizationPlan(value.id, { removeFromInbox: false })).toBe(response);
    expect(transport).toHaveBeenLastCalledWith('gmail:apply-organization-plan', value.id, { removeFromInbox: false });
    expect(await bridge.undoOrganizationPlan()).toBe(response);
    expect(transport).toHaveBeenLastCalledWith('gmail:undo-organization-plan', undefined);
  });

  it('navegar aborta el diálogo pendiente y no espera una respuesta tardía para detener el plan', async () => {
    let shown!: () => void, answer!: (value: { response: number; checkboxChecked: boolean }) => void;
    const ready = new Promise<void>(resolve => { shown = resolve; }); let signal: AbortSignal | undefined;
    vi.mocked(dialog.showMessageBox).mockImplementationOnce((...args: unknown[]) => {
      signal = (args[1] as MessageBoxOptions).signal;
      shown(); return new Promise(resolve => { answer = resolve; });
    });
    const pending = invoke('gmail:apply-organization-plan', value.id); await ready;
    sender.emit('did-start-navigation', {}, sender.mainFrame.url, false, true);
    expect(await pending).toMatchObject({ success: false }); expect(signal?.aborted).toBe(true);
    answer({ response: 1, checkboxChecked: false }); await Promise.resolve();
    expect(fx.createLabel).not.toHaveBeenCalled(); expect(sender.listenerCount('did-start-navigation')).toBe(0);
  });
});
