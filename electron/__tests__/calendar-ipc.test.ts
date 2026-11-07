import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { EventEmitter } from 'node:events';
import { app, dialog, ipcMain, type BrowserWindow, type IpcMainInvokeEvent, type MessageBoxOptions } from 'electron';
import { CalendarService } from '../calendar-service';
import { registerCalendarHandlers } from '../calendar-handlers';
import { getAuthState, resetAuthStateForTests, setAuthState } from '../main/auth-state';
import { CALENDAR_APPROVAL_MS } from '../calendar/ipc-authorization';

let service: CalendarService;
let win: BrowserWindow;
let orb: BrowserWindow;
let sender: EventEmitter & { isDestroyed: () => boolean; mainFrame: object; send: ReturnType<typeof vi.fn> };
let event: IpcMainInvokeEvent;
const documentUrl = () => pathToFileURL(path.join(app.getAppPath(), 'dist', 'index.html')).href;
const input = () => ({ title: 'Revisión', start: '2026-10-22T10:00:00-06:00', end: '2026-10-22T11:00:00-06:00' });
const harness = ipcMain as unknown as { _getHandler(channel: string): (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown> };
const invoke = async (channel: string, ...args: unknown[]) => harness._getHandler(channel)(event, ...args);

beforeEach(() => {
  vi.clearAllMocks();
  resetAuthStateForTests(); setAuthState({ authenticated: true, userId: 'usuario' });
  sender = Object.assign(new EventEmitter(), { isDestroyed: () => false, mainFrame: { url: documentUrl() }, send: vi.fn() });
  win = { webContents: sender, isDestroyed: () => false } as unknown as BrowserWindow;
  orb = { webContents: Object.assign(new EventEmitter(), { isDestroyed: () => false, mainFrame: { url: documentUrl() } }), isDestroyed: () => false } as unknown as BrowserWindow;
  event = { sender, senderFrame: sender.mainFrame } as unknown as IpcMainInvokeEvent;
  service = new CalendarService({ load: vi.fn(async () => []), save: vi.fn(async () => {}) });
  service.setUserId('usuario');
  service.connections.set('google', { provider: 'google', email: 'cuenta@example.test', userId: 'usuario', accessToken: 'token-privado', refreshToken: 'renovacion-privada', isActive: true });
  vi.spyOn(service, 'createEvent').mockImplementation(async (_input, guard) => { guard?.(); return { success: true, eventId: 'nuevo' }; });
  vi.spyOn(service, 'deleteEvent').mockImplementation(async (_id, _calendar, guard) => { guard?.(); return { success: true }; });
  vi.spyOn(service, 'updateEvent').mockResolvedValue({ success: true });
  vi.spyOn(service, 'connectGoogle').mockResolvedValue({ success: true, email: 'cuenta@example.test' });
  vi.spyOn(service, 'getCurrentEvents').mockResolvedValue([{ id: 'evento', title: 'Lectura', start: new Date(input().start), end: new Date(input().end), isAllDay: false, source: 'google' }]);
  vi.mocked(dialog.showMessageBox).mockResolvedValue({ response: 1, checkboxChecked: false });
  registerCalendarHandlers(service, () => win, () => orb);
});
afterEach(() => { service.dispose(); vi.restoreAllMocks(); vi.useRealTimers(); resetAuthStateForTests(); });

describe('Frontera IPC del calendario', () => {
  it('rechaza una conexión cuyo dueño no coincide con el actor', async () => {
    service.connections.get('google')!.userId = 'otro-usuario';
    expect(await invoke('calendar:create-event', input())).toMatchObject({ success: false });
    expect(dialog.showMessageBox).not.toHaveBeenCalled(); expect(service.createEvent).not.toHaveBeenCalled();
  });
  it('entrega fechas ISO y conexiones sin credenciales', async () => {
    const result = await invoke('calendar:get-events');
    expect(result).toMatchObject({ success: true, events: [{ start: '2026-10-22T16:00:00.000Z' }] });
    const connections = await invoke('calendar:get-connections');
    expect(JSON.stringify(connections)).not.toMatch(/privad|accessToken|refreshToken/);
    expect(sender.listenerCount('did-start-navigation')).toBe(0);
  });
  it.each(['sesion', 'emisor', 'subframe', 'ventana', 'origen'])('rechaza contexto inválido antes del servicio: %s', async mode => {
    if (mode === 'origen') Object.assign(sender.mainFrame, { url: 'https://externo.example.test/' });
    if (mode === 'sesion') setAuthState({ authenticated: false, userId: null });
    if (mode === 'emisor') win = { ...win, webContents: {} } as BrowserWindow;
    if (mode === 'subframe') event = { ...event, senderFrame: {} } as IpcMainInvokeEvent;
    if (mode === 'ventana') win = { ...win, isDestroyed: () => true } as unknown as BrowserWindow;
    expect(await invoke('calendar:create-event', input())).toMatchObject({ success: false });
    expect(service.createEvent).not.toHaveBeenCalled(); expect(dialog.showMessageBox).not.toHaveBeenCalled();
  });
  it('autoriza el marco principal de la orbe registrada', async () => {
    event = { sender: orb.webContents, senderFrame: orb.webContents.mainFrame } as IpcMainInvokeEvent;
    expect(await invoke('calendar:create-event', input())).toMatchObject({ success: true });
    expect(dialog.showMessageBox).toHaveBeenCalledWith(orb, expect.anything());
  });
  it.each([
    { ...input(), title: '' }, { ...input(), start: 'no-fecha' }, { ...input(), end: input().start },
    { ...input(), extra: true }, { ...input(), title: 'x'.repeat(501) }, { ...input(), start: '2026-10-22' },
  ])('rechaza entradas inválidas antes de mostrar confirmación', async value => {
    expect(await invoke('calendar:create-event', value)).toMatchObject({ success: false });
    expect(dialog.showMessageBox).not.toHaveBeenCalled(); expect(service.createEvent).not.toHaveBeenCalled();
  });
  it('confirma datos exactos y convierte fechas al contrato del servicio', async () => {
    expect(await invoke('calendar:create-event', input())).toEqual({ success: true, eventId: 'nuevo' });
    expect(service.createEvent).toHaveBeenCalledWith({ ...input(), start: new Date(input().start), end: new Date(input().end) }, expect.any(Function));
    const options = (vi.mocked(dialog.showMessageBox).mock.calls as unknown as [BrowserWindow, MessageBoxOptions][])[0][1];
    expect(options).toMatchObject({ defaultId: 0, cancelId: 0 });
    expect(options.detail).toContain('cuenta@example.test'); expect(options.detail).toContain('Revisión');
    expect(options.detail).not.toContain('token-privado');
  });
  it('cancelar no produce efectos', async () => {
    vi.mocked(dialog.showMessageBox).mockResolvedValueOnce({ response: 0, checkboxChecked: false });
    expect(await invoke('calendar:delete-event', 'evento')).toMatchObject({ success: false, cancelled: true });
    expect(service.deleteEvent).not.toHaveBeenCalled();
  });
  it.each(['sesion', 'reautenticacion', 'navegacion', 'conexion', 'ventana', 'marco'])('invalida aceptación tras cambio de contexto: %s', async mode => {
    vi.mocked(dialog.showMessageBox).mockImplementationOnce(async () => {
      if (mode === 'sesion' || mode === 'reautenticacion') { setAuthState({ authenticated: false, userId: null }); if (mode === 'reautenticacion') setAuthState({ authenticated: true, userId: 'usuario' }); }
      if (mode === 'navegacion') sender.emit('did-start-navigation', {}, 'file:///otra', false, true);
      if (mode === 'conexion') service.connections.delete('google');
      if (mode === 'ventana') win = { ...win } as unknown as BrowserWindow;
      if (mode === 'marco') sender.mainFrame = {};
      return { response: 1, checkboxChecked: false };
    });
    expect(await invoke('calendar:delete-event', 'evento')).toMatchObject({ success: false });
    expect(service.deleteEvent).not.toHaveBeenCalled();
    expect(sender.listenerCount('did-start-navigation')).toBe(0);
  });
  it('no ejecuta aceptación vencida ni permite otro diálogo mientras el nativo siga abierto', async () => {
    vi.useFakeTimers(); let finish!: (value: { response: number; checkboxChecked: boolean }) => void;
    vi.mocked(dialog.showMessageBox).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const pending = invoke('calendar:delete-event', 'evento'); await Promise.resolve(); await Promise.resolve();
    expect(await invoke('calendar:delete-event', 'otro')).toMatchObject({ success: false });
    await vi.advanceTimersByTimeAsync(CALENDAR_APPROVAL_MS);
    expect(await pending).toMatchObject({ success: false });
    expect(await invoke('calendar:delete-event', 'tercero')).toMatchObject({ success: false });
    finish({ response: 1, checkboxChecked: false }); await Promise.resolve(); await Promise.resolve();
    expect(service.deleteEvent).not.toHaveBeenCalled();
  });
  it('sanea errores de conexión y del servicio', async () => {
    vi.mocked(service.connectGoogle).mockResolvedValueOnce({ success: false, error: 'token-privado C:/secreto' });
    expect(JSON.stringify(await invoke('calendar:connect-google'))).not.toMatch(/privado|C:/);
    vi.mocked(service.createEvent).mockRejectedValueOnce(new Error('token-privado C:/secreto'));
    expect(JSON.stringify(await invoke('calendar:create-event', input()))).not.toMatch(/privado|C:/);
  });
  it('explica la ausencia de custodia segura sin propagar el error interno', async () => {
    vi.mocked(service.connectGoogle).mockResolvedValueOnce({ success: false, errorCode: 'secure_storage_unavailable', error: 'privado C:/interno' });
    const result = await invoke('calendar:connect-google');
    expect(result).toMatchObject({ success: false, error: expect.stringContaining('llavero') });
    expect(JSON.stringify(result)).not.toMatch(/privado|interno/);
  });
  it('proyecta eventos sin reenviar conexión, errores ni tokens, y calla sin sesión', () => {
    service.emit('token-refreshed', { provider: 'google', connection: service.connections.get('google') });
    service.emit('session-restore-failed', { provider: 'google', email: 'cuenta@example.test', error: 'token-privado' });
    expect(sender.send).toHaveBeenCalledWith('calendar:token-refreshed', { provider: 'google' });
    expect(JSON.stringify(sender.send.mock.calls)).not.toMatch(/privado|accessToken|connection|error/);
    sender.send.mockClear(); setAuthState({ authenticated: false, userId: null });
    service.emit('connected', { provider: 'google' }); expect(sender.send).not.toHaveBeenCalled();
  });
  it('rechaza argumentos extras y actualizaciones con un solo extremo de intervalo', async () => {
    expect(await invoke('calendar:get-events', 'extra')).toMatchObject({ success: false });
    expect(await invoke('calendar:update-event', 'evento', { start: input().start })).toMatchObject({ success: false });
    expect(await invoke('calendar:delete-event', '', 'primary')).toMatchObject({ success: false });
    expect(dialog.showMessageBox).not.toHaveBeenCalled();
    expect(getAuthState().authenticated).toBe(true);
  });
});
