import { EventEmitter } from 'node:events';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { app, ipcMain, dialog, type BrowserWindow, type IpcMainInvokeEvent, type MessageBoxOptions } from 'electron';
import { setAuthState, resetAuthStateForTests } from '../main/auth-state';
import { registerGmailHandlers } from '../gmail-handlers';
import { exposeGoogleApis } from '../preload/google-apis';
import { mailboxFixture } from './gmail-mailbox/fixtures';
import { owner } from './gmail-plans/fixtures';

let root: string, fx: ReturnType<typeof mailboxFixture>;
let sender: EventEmitter & { mainFrame: { url: string }; isDestroyed(): boolean };
let window: BrowserWindow, event: IpcMainInvokeEvent;
const harness = ipcMain as unknown as { _getHandler(channel: string): (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown> };
const invoke = (channel: string, ...args: unknown[]) => harness._getHandler(channel)(event, ...args);
const mutations: Array<[string, unknown[]]> = [
  ['gmail:modify-labels', ['msg-0', ['Nueva'], ['INBOX']]], ['gmail:trash', ['msg-0']],
  ['gmail:create-label', ['Nueva']], ['gmail:delete-label', ['Other_1']],
  ['gmail:batch-modify-by-label', ['Work_1']], ['gmail:empty-and-delete-all-labels', []],
];
const channels = ['gmail:get-messages', 'gmail:get-message', 'gmail:get-labels', ...mutations.map(([channel]) => channel)];
beforeEach(async () => {
  vi.clearAllMocks(); resetAuthStateForTests(); setAuthState({ authenticated: true, userId: owner.userId });
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'soflia-mailbox-ipc-')); fx = mailboxFixture(root);
  sender = Object.assign(new EventEmitter(), { isDestroyed: () => false, mainFrame: { url: pathToFileURL(path.join(app.getAppPath(), 'dist', 'index.html')).href } });
  window = { webContents: sender, isDestroyed: () => false } as unknown as BrowserWindow;
  event = { sender, senderFrame: sender.mainFrame } as unknown as IpcMainInvokeEvent;
  vi.mocked(dialog.showMessageBox).mockResolvedValue({ response: 1, checkboxChecked: false });
  registerGmailHandlers(fx.service, () => window);
});
afterEach(async () => { vi.restoreAllMocks(); resetAuthStateForTests(); await fs.rm(root, { recursive: true, force: true }); });

describe('Nueve canales del buzón Gmail', () => {
  it.each(channels)('deniega frame ajeno: %s', async channel => {
    event = { ...event, senderFrame: {} } as IpcMainInvokeEvent;
    expect(await invoke(channel)).toMatchObject({ success: false }); expect(fx.acquire).not.toHaveBeenCalled();
    expect(dialog.showMessageBox).not.toHaveBeenCalled(); expect(sender.listenerCount('destroyed')).toBe(0);
  });
  it.each([
    ['gmail:get-messages', [{ maxResults: 101 }]], ['gmail:get-messages', [null]],
    ['gmail:get-message', ['../archivo']], ['gmail:get-labels', ['extra']],
    ['gmail:modify-labels', ['msg-0', ['Etiqueta\nConfirmar']]], ['gmail:trash', []],
    ['gmail:create-label', ['\u202eoculta']], ['gmail:delete-label', ['constructor']],
    ['gmail:batch-modify-by-label', ['Work_1', { deleteLabel: 'false' }]], ['gmail:empty-and-delete-all-labels', [{}]],
  ] as Array<[string, unknown[]]>)('rechaza payload antes del servicio: %s %#', async (channel, args) => {
    expect(await invoke(channel, ...args)).toMatchObject({ success: false }); expect(fx.acquire).not.toHaveBeenCalled();
    expect(dialog.showMessageBox).not.toHaveBeenCalled();
  });
  it.each(mutations)('confirma cuenta y alcance en main: %s', async (channel, args) => {
    expect(await invoke(channel, ...args)).toMatchObject({ success: true });
    const calls = vi.mocked(dialog.showMessageBox).mock.calls as unknown as [BrowserWindow, MessageBoxOptions][];
    expect(calls).toHaveLength(1); expect(calls[0][0]).toBe(window);
    expect(calls[0][1]).toMatchObject({ defaultId: 0, cancelId: 0 });
    expect(calls[0][1].detail).toContain(owner.email); expect(calls[0][1].signal).toBeInstanceOf(AbortSignal);
    expect(sender.listenerCount('did-start-navigation')).toBe(0);
    expect(await fs.readdir(root)).toEqual([]);
  });
  it.each(mutations)('cancelar no ejecuta efectos: %s', async (channel, args) => {
    vi.mocked(dialog.showMessageBox).mockResolvedValueOnce({ response: 0, checkboxChecked: false });
    expect(await invoke(channel, ...args)).toMatchObject({ success: false, cancelled: true });
    for (const effect of [fx.modify, fx.trash, fx.createLabel, fx.deleteLabel, fx.batchModify]) expect(effect).not.toHaveBeenCalled();
  });
  it.each(['sesión', 'origen', 'ventana', 'cuenta'])('deniega contexto inválido: %s', async mode => {
    if (mode === 'sesión') setAuthState({ authenticated: false, userId: null });
    if (mode === 'origen') sender.mainFrame.url = 'https://otro.example.test';
    if (mode === 'ventana') window = { ...window, isDestroyed: () => true } as unknown as BrowserWindow;
    if (mode === 'cuenta') fx.calendar.connections.get('google')!.userId = 'otro';
    expect(await invoke('gmail:trash', 'msg-0')).toMatchObject({ success: false });
    expect(fx.acquire).not.toHaveBeenCalled(); expect(dialog.showMessageBox).not.toHaveBeenCalled();
  });
  it.each(['A/B/A', 'navegación', 'conexión'])('invalida aprobación después de %s', async mode => {
    vi.mocked(dialog.showMessageBox).mockImplementationOnce(async () => {
      if (mode === 'A/B/A') { setAuthState({ authenticated: false, userId: null }); setAuthState({ authenticated: true, userId: owner.userId }); }
      if (mode === 'navegación') sender.emit('did-start-navigation', {}, sender.mainFrame.url, false, true);
      if (mode === 'conexión') fx.calendar.contextRevision++;
      return { response: 1, checkboxChecked: false };
    });
    expect(await invoke('gmail:trash', 'msg-0')).toMatchObject({ success: false }); expect(fx.trash).not.toHaveBeenCalled();
    expect(sender.listenerCount('destroyed')).toBe(0);
  });
  it('las lecturas no exigen aprobación ni mutan', async () => {
    expect(await invoke('gmail:get-messages', { maxResults: 10 })).toMatchObject({ success: true, messages: expect.any(Array) });
    expect(await invoke('gmail:get-message', 'msg-0')).toMatchObject({ success: true, message: { id: 'msg-0' } });
    expect(await invoke('gmail:get-labels')).toMatchObject({ success: true, labels: expect.any(Array) });
    expect(dialog.showMessageBox).not.toHaveBeenCalled(); expect(fx.modify).not.toHaveBeenCalled();
  });
  it('el contenido de una lectura tardía no vuelve a la sesión nueva', async () => {
    fx.labelsList.mockImplementationOnce(async () => { setAuthState({ authenticated: true, userId: 'usuario-B' }); return { data: { labels: [{ id: 'Privada', name: 'Nombre privado', type: 'user' }] } }; });
    const result = await invoke('gmail:get-labels'); expect(result).toMatchObject({ success: false });
    expect(JSON.stringify(result)).not.toContain('Nombre privado'); expect(result).not.toHaveProperty('labels');
  });
  it('la invalidación después de un lote conserva el conteo y omite nombres de la cuenta anterior', async () => {
    fx = mailboxFixture(root, 101); registerGmailHandlers(fx.service, () => window);
    const apply = fx.batchModify.getMockImplementation()!;
    fx.batchModify.mockImplementationOnce(async args => {
      const response = await apply(args);
      queueMicrotask(() => queueMicrotask(() => { setAuthState({ authenticated: true, userId: 'usuario-B' }); }));
      return response;
    });
    const result = await invoke('gmail:batch-modify-by-label', 'Work_1');
    expect(result).toMatchObject({ success: false, processed: 100, effectsConfirmed: 1, partial: true, uncertain: true, recoveryRequired: true });
    expect(result).not.toHaveProperty('labelsCreated'); expect(JSON.stringify(result)).not.toContain('Trabajo');
    expect(fx.batchModify).toHaveBeenCalledOnce(); expect(sender.listenerCount('destroyed')).toBe(0);
  });
  it('preload transporta opciones y resultado parcial completos, sin canales nuevos', async () => {
    const result = { success: false, processed: 100, labelDeleted: false, partial: true, uncertain: true };
    const safeInvoke = vi.fn(async () => result), exposed: Record<string, unknown> = {};
    exposeGoogleApis({ exposeInMainWorld: (name, api) => { exposed[name] = api; } }, { safeInvoke } as never);
    const api = exposed.gmail as Window['gmail'];
    expect(await api.batchModifyByLabel('Work_1', { deleteLabel: true })).toBe(result);
    expect(safeInvoke).toHaveBeenCalledExactlyOnceWith('gmail:batch-modify-by-label', 'Work_1', { deleteLabel: true });
  });
});
