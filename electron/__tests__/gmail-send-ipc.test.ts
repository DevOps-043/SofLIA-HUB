import { EventEmitter } from 'node:events';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { app, dialog, ipcMain, type BrowserWindow, type IpcMainInvokeEvent, type MessageBoxOptions } from 'electron';
import { GmailService } from '../gmail/service';
import type { CalendarService } from '../calendar-service';
import type { GmailClient } from '../gmail/types';
import { registerGmailHandlers } from '../gmail-handlers';
import { resetAuthStateForTests, setAuthState } from '../main/auth-state';
import { IPC_APPROVAL_MS } from '../ipc/caller-authorization';
import { exposeGoogleApis } from '../preload/google-apis';
import type { SendEmailParams } from '../../src/shared/gmail-delivery';

const harness = ipcMain as unknown as { _getHandler(channel: string): (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown> };
let sender: EventEmitter & { mainFrame: { url: string }; isDestroyed(): boolean };
let win: BrowserWindow;
let orb: BrowserWindow;
let event: IpcMainInvokeEvent;
let calendar: CalendarService;
let send: ReturnType<typeof vi.fn>;
const input = () => ({ to: ['dest@example.test'], cc: ['copia@example.test'], subject: 'Solicitud', body: 'Contenido íntegro' });
const invoke = (...args: unknown[]) => harness._getHandler('gmail:send')(event, ...args);

beforeEach(() => {
  vi.clearAllMocks(); resetAuthStateForTests(); setAuthState({ authenticated: true, userId: 'usuario' });
  sender = Object.assign(new EventEmitter(), { mainFrame: { url: pathToFileURL(path.join(app.getAppPath(), 'dist', 'index.html')).href }, isDestroyed: () => false });
  win = { webContents: sender, isDestroyed: () => false } as unknown as BrowserWindow;
  orb = { webContents: Object.assign(new EventEmitter(), { mainFrame: { url: sender.mainFrame.url }, isDestroyed: () => false }), isDestroyed: () => false } as unknown as BrowserWindow;
  event = { sender, senderFrame: sender.mainFrame } as unknown as IpcMainInvokeEvent;
  calendar = { userId: 'usuario', contextRevision: 0, connections: new Map([['google', { provider: 'google', userId: 'usuario', email: 'cuenta@example.test', isActive: true }]]) } as unknown as CalendarService;
  send = vi.fn(async () => ({ data: { id: 'mensaje-1' } }));
  const service = new GmailService(calendar);
  vi.spyOn(service, 'getClient').mockResolvedValue({ client: { users: { messages: { send } } } as unknown as GmailClient });
  vi.mocked(dialog.showMessageBox).mockResolvedValue({ response: 1, checkboxChecked: false });
  registerGmailHandlers(service, () => win, () => orb);
});
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); resetAuthStateForTests(); });

describe('Autorización del envío Gmail por IPC', () => {
  it('el preload transporta sólo el envío al canal permitido y conserva incertidumbre', async () => {
    const result = { success: false, uncertain: true, error: 'Revisa Enviados' };
    const invoke = vi.fn(async () => result);
    let bridge!: { send(params: SendEmailParams): Promise<unknown> };
    exposeGoogleApis({ exposeInMainWorld: (name, value) => { if (name === 'gmail') bridge = value as typeof bridge; } }, {
      safeInvoke: invoke, safeSend: vi.fn(), safeOn: vi.fn(() => vi.fn()), safeRemoveAllListeners: vi.fn(),
      sanitizePayload: value => value, validateChannel: vi.fn(),
    });
    expect(await bridge.send(input())).toBe(result);
    expect(invoke).toHaveBeenCalledExactlyOnceWith('gmail:send', input());
  });
  it('confirma el contenido y la cuenta exactos y libera listeners', async () => {
    expect(await invoke(input())).toEqual({ success: true, messageId: 'mensaje-1' });
    const call = (vi.mocked(dialog.showMessageBox).mock.calls as unknown as [BrowserWindow, MessageBoxOptions][])[0];
    expect(call[0]).toBe(win);
    expect(call[1]).toMatchObject({ defaultId: 0, cancelId: 0, title: 'Confirmar envío de correo' });
    expect(JSON.stringify(call[1])).toContain('cuenta@example.test');
    expect(JSON.stringify(call[1])).toContain('Contenido íntegro');
    expect(send).toHaveBeenCalledOnce();
    expect(sender.listenerCount('did-start-navigation')).toBe(0);
  });

  it.each(['sesión', 'emisor', 'subframe', 'origen', 'ventana', 'dueño'])('rechaza %s inválido antes de confirmar', async mode => {
    if (mode === 'sesión') setAuthState({ authenticated: false, userId: null });
    if (mode === 'emisor') win = { ...win, webContents: {} } as BrowserWindow;
    if (mode === 'subframe') event = { ...event, senderFrame: {} } as IpcMainInvokeEvent;
    if (mode === 'origen') sender.mainFrame.url = 'https://externo.example.test/';
    if (mode === 'ventana') win = { ...win, isDestroyed: () => true } as unknown as BrowserWindow;
    if (mode === 'dueño') calendar.connections.get('google')!.userId = 'otro';
    expect(await invoke(input())).toMatchObject({ success: false });
    expect(send).not.toHaveBeenCalled(); expect(dialog.showMessageBox).not.toHaveBeenCalled();
    expect(sender.listenerCount('destroyed')).toBe(0);
  });

  it('permite el marco principal de la orbe registrada', async () => {
    event = { sender: orb.webContents, senderFrame: orb.webContents.mainFrame } as IpcMainInvokeEvent;
    expect(await invoke(input())).toMatchObject({ success: true });
    expect(vi.mocked(dialog.showMessageBox).mock.calls[0][0]).toBe(orb);
  });

  it.each([{ args: [] }, { args: [input(), 'extra'] }, { args: [{ ...input(), extra: true }] }])('rechaza cantidad o schema de argumentos: %#', async ({ args }) => {
    expect(await invoke(...args)).toMatchObject({ success: false });
    expect(send).not.toHaveBeenCalled(); expect(dialog.showMessageBox).not.toHaveBeenCalled();
  });

  it('cancelar el diálogo conserva el correo sin enviar', async () => {
    vi.mocked(dialog.showMessageBox).mockResolvedValueOnce({ response: 0, checkboxChecked: false });
    expect(await invoke(input())).toMatchObject({ success: false, cancelled: true });
    expect(send).not.toHaveBeenCalled();
  });

  it.each(['logout', 'A/B/A', 'navegación', 'conexión', 'marco'])('invalida la aprobación tras %s', async mode => {
    vi.mocked(dialog.showMessageBox).mockImplementationOnce(async () => {
      if (mode === 'logout' || mode === 'A/B/A') {
        setAuthState({ authenticated: false, userId: null });
        if (mode === 'A/B/A') setAuthState({ authenticated: true, userId: 'usuario' });
      }
      if (mode === 'navegación') sender.emit('did-start-navigation', {}, sender.mainFrame.url, false, true);
      if (mode === 'conexión') calendar.connections.set('google', { ...calendar.connections.get('google')! });
      if (mode === 'marco') Object.assign(sender, { mainFrame: { url: sender.mainFrame.url } });
      return { response: 1, checkboxChecked: false };
    });
    expect(await invoke(input())).toMatchObject({ success: false }); expect(send).not.toHaveBeenCalled();
    expect(sender.listenerCount('did-start-navigation')).toBe(0);
  });

  it('rechaza una respuesta expirada y no permite otro diálogo mientras siga abierto', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    let answer!: (response: { response: number; checkboxChecked: boolean }) => void;
    let entered!: () => void;
    const shown = new Promise<void>(resolve => { entered = resolve; });
    vi.mocked(dialog.showMessageBox).mockImplementationOnce(() => { entered(); return new Promise(resolve => { answer = resolve; }); });
    const pending = invoke(input());
    await shown;
    await vi.advanceTimersByTimeAsync(IPC_APPROVAL_MS);
    expect(await pending).toMatchObject({ success: false });
    expect(await invoke(input())).toMatchObject({ success: false });
    expect(dialog.showMessageBox).toHaveBeenCalledOnce();
    answer({ response: 1, checkboxChecked: false });
    await Promise.resolve(); await Promise.resolve();
    expect(send).not.toHaveBeenCalled();
  });
});
