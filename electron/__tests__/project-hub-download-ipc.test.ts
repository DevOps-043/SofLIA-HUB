import { EventEmitter } from 'node:events';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { app, dialog, ipcMain, type BrowserWindow, type IpcMainInvokeEvent, type MessageBoxOptions } from 'electron';
import { registerProjectHubHandlers } from '../project-hub-handlers';
import type { ProjectHubApiService } from '../project-hub';
import type { ProjectHubDownloadAuthorization } from '../project-hub/download';
import { exposeProjectHubApi } from '../preload/project-hub-api';
import { createSafeIpc } from '../preload/safe-ipc';
import { resetAuthStateForTests, setAuthState } from '../main/auth-state';
import { deferred, WORKSPACE_ID as ID } from './project-hub/fixtures';

const OP = '32345678-1234-4123-8123-123456789012';
const harness = ipcMain as unknown as { _getHandler(channel: string): (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<Record<string, unknown>> };
let event: IpcMainInvokeEvent;
let sender: EventEmitter & { mainFrame: { url: string }; isDestroyed(): boolean };
let win: BrowserWindow | null;
const service = { getStatus: vi.fn(), getProject: vi.fn(), downloadFile: vi.fn(), uploadFiles: vi.fn(), createTask: vi.fn() };
const input = () => ({ workspaceId: ID, projectId: ID, evidenceId: ID, operationId: OP });
const invoke = (...args: unknown[]) => harness._getHandler('project-hub:download-file')(event, ...args);
beforeEach(() => {
  vi.clearAllMocks(); resetAuthStateForTests(); setAuthState({ authenticated: true, userId: 'usuario' });
  sender = Object.assign(new EventEmitter(), { mainFrame: { url: pathToFileURL(path.join(app.getAppPath(), 'dist', 'index.html')).href }, isDestroyed: () => false });
  win = { webContents: sender, isDestroyed: () => false } as unknown as BrowserWindow;
  event = { sender, senderFrame: sender.mainFrame } as unknown as IpcMainInvokeEvent;
  service.getStatus.mockReset().mockResolvedValue({ authenticated: true, workspaces: [{ id: ID, name: 'Workspace comprobado' }] });
  service.getProject.mockReset().mockResolvedValue({ success: true, data: { project_id: ID, workspace_id: ID, project_name: 'Proyecto comprobado' } });
  service.downloadFile.mockReset().mockImplementation(async (_input: unknown, auth: ProjectHubDownloadAuthorization) => {
    auth.assertCurrent(); const selected = await auth.chooseDestination({ name: 'archivo.txt', extension: 'txt', mime: 'text/plain', size: 4, sha256: 'a'.repeat(64), storagePath: 'ruta-main' });
    auth.assertCurrent(); return selected ? { success: true, data: { saved: true, bytes: 4 } } : { success: false, cancelled: true, data: { saved: false, bytes: 0 } };
  });
  service.uploadFiles.mockReset().mockResolvedValue({ success: true }); service.createTask.mockReset().mockResolvedValue({ success: true });
  vi.mocked(dialog.showSaveDialog).mockResolvedValue({ canceled: false, filePath: 'C:/ruta-ficticia/copia.txt' });
  vi.mocked(dialog.showMessageBox).mockResolvedValue({ response: 1, checkboxChecked: false });
  registerProjectHubHandlers(service as unknown as ProjectHubApiService, () => win);
});
afterEach(() => { vi.restoreAllMocks(); resetAuthStateForTests(); });
describe('Descarga main por IPC autorizado', () => {
  it.each(['sin ventana', 'sin sesión', 'subframe', 'origen'])('deniega %s antes del servicio/selector', async mode => {
    if (mode === 'sin ventana') win = null;
    if (mode === 'sin sesión') setAuthState({ authenticated: false, userId: null });
    if (mode === 'subframe') event = { ...event, senderFrame: {} } as IpcMainInvokeEvent;
    if (mode === 'origen') sender.mainFrame.url = 'https://externo.example.test';
    expect((await invoke(input())).success).toBe(false); expect(dialog.showSaveDialog).not.toHaveBeenCalled();
    expect(service.downloadFile).not.toHaveBeenCalled(); expect(sender.eventNames()).toEqual([]);
  });
  it.each([[], [input(), 'extra'], [{ ...input(), path: 'C:/no-permitido' }], [{ ...input(), url: 'https://externo.test' }], [{ ...input(), operationId: 'no-uuid' }], [{ ...input(), evidenceId: 'no-uuid' }]].map(args => ({ args })))('rechaza payload/aridad: %#', async ({ args }) => {
    expect((await invoke(...args)).success).toBe(false); expect(service.downloadFile).not.toHaveBeenCalled();
  });
  it('HITL revisa archivo y proyecto; ruta queda sólo en callback main', async () => {
    expect(await invoke(input())).toEqual({ success: true, data: { saved: true, bytes: 4 } });
    const [, options] = vi.mocked(dialog.showMessageBox).mock.calls[0] as unknown as [BrowserWindow, MessageBoxOptions];
    expect(options).toMatchObject({ defaultId: 0, cancelId: 0 }); expect(options.detail).toContain('Proyecto comprobado');
    expect(options.detail).toContain('archivo.txt'); expect(options.detail).toContain('a'.repeat(64));
    expect(service.downloadFile.mock.calls[0][0]).toEqual(input()); expect(sender.eventNames()).toEqual([]);
  });
  it.each(['HITL', 'selector'])('cancelar %s no informa copia guardada', async mode => {
    if (mode === 'HITL') vi.mocked(dialog.showMessageBox).mockResolvedValueOnce({ response: 0, checkboxChecked: false });
    else vi.mocked(dialog.showSaveDialog).mockResolvedValueOnce({ canceled: true, filePath: '' });
    expect(await invoke(input())).toMatchObject({ cancelled: true, data: { saved: false } });
    if (mode === 'HITL') expect(dialog.showSaveDialog).not.toHaveBeenCalled();
  });
  it('cancelar sólo coincide en tipo/id y no libera el slot hasta cerrar selector', async () => {
    const picker = deferred<{ canceled: boolean; filePath: string }>(); const started = deferred<void>(); let signal!: AbortSignal;
    const implementation = service.downloadFile.getMockImplementation()!;
    service.downloadFile.mockImplementationOnce(async (value, auth) => { signal = auth.signal; return implementation(value, auth); });
    vi.mocked(dialog.showSaveDialog).mockImplementationOnce(() => { started.resolve(); return picker.promise; });
    const pending = invoke(input()); await started.promise;
    await harness._getHandler('project-hub:cancel-upload')(event, { operationId: OP });
    await harness._getHandler('project-hub:cancel-download')(event, { operationId: ID }); expect(signal.aborted).toBe(false);
    expect(await harness._getHandler('project-hub:upload-files')(event, { workspaceId: ID, projectId: ID, operationId: OP })).toMatchObject({ code: 'UPLOAD_BUSY' });
    await harness._getHandler('project-hub:cancel-download')(event, { operationId: OP }); expect(signal.aborted).toBe(true);
    expect(await invoke(input())).toMatchObject({ code: 'DOWNLOAD_BUSY' });
    picker.resolve({ canceled: false, filePath: 'C:/ruta-ficticia/copia.txt' }); expect(await pending).toMatchObject({ cancelled: true });
    expect((await invoke(input())).success).toBe(true); expect(sender.eventNames()).toEqual([]);
  });
  it('otro frame no cancela y navegación invalida el selector pendiente', async () => {
    const picker = deferred<{ canceled: boolean; filePath: string }>(); const started = deferred<void>();
    vi.mocked(dialog.showSaveDialog).mockImplementationOnce(() => { started.resolve(); return picker.promise; });
    const pending = invoke(input()); await started.promise;
    expect(await harness._getHandler('project-hub:cancel-download')({ ...event, senderFrame: {} } as IpcMainInvokeEvent, { operationId: OP })).toMatchObject({ success: false });
    sender.emit('did-start-navigation', {}, sender.mainFrame.url, false, true); picker.resolve({ canceled: false, filePath: 'C:/ruta-ficticia/copia.txt' });
    expect(await pending).toMatchObject({ success: false, cancelled: true }); expect(sender.eventNames()).toEqual([]);
  });
  it('no oculta una copia ya publicada cuando cambia el contexto', async () => {
    service.downloadFile.mockImplementationOnce(async () => {
      sender.emit('did-start-navigation', {}, sender.mainFrame.url, false, true);
      return { success: false, cancelled: true, recoveryRequired: true, data: { saved: true, bytes: 4 } };
    });
    expect(await invoke(input())).toMatchObject({ data: { saved: true }, recoveryRequired: true });
  });
  it('preload transporta IDs; safeIpc bloquea el canal de URL anterior', async () => {
    let bridge!: { downloadFile(value: unknown): Promise<unknown>; cancelDownload(value: unknown): Promise<unknown> };
    const ipc = createSafeIpc({ invoke: (channel, ...args) => harness._getHandler(channel)(event, ...args), send: vi.fn(), on: vi.fn(), off: vi.fn(), removeAllListeners: vi.fn() });
    exposeProjectHubApi({ exposeInMainWorld: (_name, value) => { bridge = value as typeof bridge; } }, ipc);
    expect(await bridge.downloadFile(input())).toMatchObject({ success: true }); expect(await bridge.cancelDownload({ operationId: OP })).toMatchObject({ success: true });
    expect(() => ipc.safeInvoke('project-hub:get-download', {})).toThrow(); expect('getDownload' in bridge).toBe(false);
  });
  it('confirmación está compartida con mutaciones de dominio', async () => {
    const answer = deferred<{ response: number; checkboxChecked: boolean }>(); const started = deferred<void>();
    vi.mocked(dialog.showMessageBox).mockImplementationOnce(() => { started.resolve(); return answer.promise; });
    const pending = harness._getHandler('project-hub:create-task')(event, { workspaceId: ID, projectId: ID, task: { title: 'Tarea ficticia' } });
    await started.promise; expect((await invoke(input())).success).toBe(false); expect(dialog.showMessageBox).toHaveBeenCalledOnce();
    answer.resolve({ response: 0, checkboxChecked: false }); await pending; expect(service.createTask).not.toHaveBeenCalled();
  });
});
