import { EventEmitter } from 'node:events';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { app, dialog, ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import { registerProjectHubHandlers } from '../project-hub-handlers';
import type { ProjectHubApiService } from '../project-hub';
import type { ProjectHubUploadAuthorization } from '../project-hub/upload';
import { exposeProjectHubApi } from '../preload/project-hub-api';
import { createSafeIpc } from '../preload/safe-ipc';
import { resetAuthStateForTests, setAuthState } from '../main/auth-state';
import { deferred, WORKSPACE_ID as ID } from './project-hub/fixtures';

const OP = '32345678-1234-4123-8123-123456789012';
const harness = ipcMain as unknown as { _getHandler(channel: string): (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<Record<string, unknown>> };
let event: IpcMainInvokeEvent;
let sender: EventEmitter & { mainFrame: { url: string }; isDestroyed(): boolean };
let win: BrowserWindow | null;
const service = { getStatus: vi.fn(), getProject: vi.fn(), uploadFiles: vi.fn(), createTask: vi.fn() };
const input = () => ({ workspaceId: ID, projectId: ID, operationId: OP });
const invoke = (...args: unknown[]) => harness._getHandler('project-hub:upload-files')(event, ...args);
beforeEach(() => {
  vi.clearAllMocks(); resetAuthStateForTests(); setAuthState({ authenticated: true, userId: 'usuario' });
  sender = Object.assign(new EventEmitter(), { mainFrame: { url: pathToFileURL(path.join(app.getAppPath(), 'dist', 'index.html')).href }, isDestroyed: () => false });
  win = { webContents: sender, isDestroyed: () => false } as unknown as BrowserWindow;
  event = { sender, senderFrame: sender.mainFrame } as unknown as IpcMainInvokeEvent;
  service.getStatus.mockReset().mockResolvedValue({ authenticated: true, workspaces: [{ id: ID, name: 'Workspace comprobado' }] });
  service.getProject.mockReset().mockResolvedValue({ success: true, data: { project_id: ID, workspace_id: ID, project_name: 'Proyecto comprobado' } });
  service.createTask.mockReset().mockResolvedValue({ success: true });
  service.uploadFiles.mockReset().mockImplementation(async (_input: unknown, auth: ProjectHubUploadAuthorization) => {
    auth.assertCurrent();
    const approved = await auth.approve([{ name: 'ficticio.txt', mime_type: 'text/plain', size: 4, sha256: 'a'.repeat(64) }]);
    auth.assertCurrent(); return approved ? { success: true, data: { requested: 1, prepared: 1, stored: 1, uploaded: 1 } } : { success: false, cancelled: true };
  });
  vi.mocked(dialog.showOpenDialog).mockResolvedValue({ canceled: false, filePaths: ['C:/ruta-ficticia/archivo.txt'] });
  vi.mocked(dialog.showMessageBox).mockResolvedValue({ response: 1, checkboxChecked: false });
  registerProjectHubHandlers(service as unknown as ProjectHubApiService, () => win);
});
afterEach(() => { vi.restoreAllMocks(); resetAuthStateForTests(); });
describe('Selección y cancelación de archivos por IPC', () => {
  it.each(['sin ventana', 'sin sesión', 'subframe', 'origen'])('deniega %s antes del selector', async mode => {
    if (mode === 'sin ventana') win = null;
    if (mode === 'sin sesión') setAuthState({ authenticated: false, userId: null });
    if (mode === 'subframe') event = { ...event, senderFrame: {} } as IpcMainInvokeEvent;
    if (mode === 'origen') sender.mainFrame.url = 'https://externo.example.test';
    expect((await invoke(input())).success).toBe(false); expect(dialog.showOpenDialog).not.toHaveBeenCalled(); expect(sender.eventNames()).toEqual([]);
  });
  it.each([[], [input(), 'extra'], [{ ...input(), paths: ['C:/no-permitido'] }], [{ ...input(), operationId: 'no-uuid' }]].map(args => ({ args })))('rechaza payload/aridad ajenos: %#', async ({ args }) => {
    expect((await invoke(...args)).success).toBe(false); expect(dialog.showOpenDialog).not.toHaveBeenCalled(); expect(service.uploadFiles).not.toHaveBeenCalled();
  });
  it('sólo pasan al servicio rutas del selector y el callback de aprobación main', async () => {
    const result = await invoke(input()); expect(result).toMatchObject({ success: true, data: { uploaded: 1 } });
    expect(service.uploadFiles.mock.calls[0][0]).toEqual({ workspaceId: ID, projectId: ID, paths: ['C:/ruta-ficticia/archivo.txt'] });
    expect(dialog.showMessageBox).toHaveBeenCalledOnce(); expect(JSON.stringify(result)).not.toContain('ruta-ficticia'); expect(sender.eventNames()).toEqual([]);
  });
  it('cancelar selector no llama al servicio ni a confirmación', async () => {
    vi.mocked(dialog.showOpenDialog).mockResolvedValueOnce({ canceled: true, filePaths: [] });
    expect(await invoke(input())).toMatchObject({ cancelled: true }); expect(service.uploadFiles).not.toHaveBeenCalled(); expect(dialog.showMessageBox).not.toHaveBeenCalled();
  });
  it('cancelación coincide con operación/caller y mantiene bloqueo hasta cerrar picker', async () => {
    const picker = deferred<{ canceled: boolean; filePaths: string[] }>(); const started = deferred<void>();
    vi.mocked(dialog.showOpenDialog).mockImplementationOnce(() => { started.resolve(); return picker.promise; });
    const pending = invoke(input()); await started.promise;
    expect(await harness._getHandler('project-hub:cancel-upload')(event, { operationId: OP })).toMatchObject({ success: true });
    expect(await invoke(input())).toMatchObject({ code: 'UPLOAD_BUSY' });
    picker.resolve({ canceled: false, filePaths: ['C:/ruta-ficticia/archivo.txt'] });
    expect(await pending).toMatchObject({ cancelled: true }); expect(service.uploadFiles).not.toHaveBeenCalled();
    expect((await invoke(input())).success).toBe(true); expect(sender.eventNames()).toEqual([]);
  });
  it('otro id no cancela el lote y navegación sí lo invalida', async () => {
    const picker = deferred<{ canceled: boolean; filePaths: string[] }>(); const started = deferred<void>();
    vi.mocked(dialog.showOpenDialog).mockImplementationOnce(() => { started.resolve(); return picker.promise; });
    const pending = invoke(input()); await started.promise;
    await harness._getHandler('project-hub:cancel-upload')(event, { operationId: ID });
    sender.emit('did-start-navigation', {}, sender.mainFrame.url, false, true);
    picker.resolve({ canceled: false, filePaths: ['C:/ruta-ficticia/archivo.txt'] });
    expect(await pending).toMatchObject({ success: false }); expect(service.uploadFiles).not.toHaveBeenCalled();
  });
  it('preload/safeIpc transporta únicamente el destino y operación nuevos', async () => {
    let bridge!: { uploadFiles(value: unknown): Promise<unknown>; cancelUpload(value: unknown): Promise<unknown> };
    const ipc = createSafeIpc({ invoke: (channel, ...args) => harness._getHandler(channel)(event, ...args), send: vi.fn(), on: vi.fn(), off: vi.fn(), removeAllListeners: vi.fn() });
    exposeProjectHubApi({ exposeInMainWorld: (_name, value) => { bridge = value as typeof bridge; } }, ipc);
    expect(await bridge.uploadFiles(input())).toMatchObject({ success: true }); expect(await bridge.cancelUpload({ operationId: OP })).toMatchObject({ success: true });
    expect(() => ipc.safeInvoke('project-hub:create-upload-intent', {})).toThrow();
  });
  it('comparte exclusión de confirmación con las mutaciones de dominio', async () => {
    const answer = deferred<{ response: number; checkboxChecked: boolean }>(); const started = deferred<void>();
    vi.mocked(dialog.showMessageBox).mockImplementationOnce(() => { started.resolve(); return answer.promise; });
    const pending = harness._getHandler('project-hub:create-task')(event, { workspaceId: ID, projectId: ID, task: { title: 'Tarea ficticia' } });
    await started.promise; expect((await invoke(input())).success).toBe(false); expect(dialog.showMessageBox).toHaveBeenCalledOnce();
    answer.resolve({ response: 0, checkboxChecked: false }); await pending; expect(service.createTask).not.toHaveBeenCalled();
  });
});
