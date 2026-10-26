import { EventEmitter } from 'node:events';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { app, dialog, ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import { exposeProjectHubApi } from '../preload/project-hub-api';
import { createSafeIpc } from '../preload/safe-ipc';
import { ALLOWED_IPC_CHANNELS } from '../preload/channels';
import { registerProjectHubHandlers } from '../project-hub-handlers';
import type { ProjectHubApiService } from '../project-hub';
import { projectHubApi } from '../../src/services/project-hub-api';
import { resetAuthStateForTests, setAuthState } from '../main/auth-state';
import { IPC_ID, projectHubIpcCases } from './project-hub/ipc-cases';

const harness = ipcMain as unknown as { _getHandler(channel: string): (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown> };
const service = Object.fromEntries(projectHubIpcCases.map(item => [item.method, vi.fn()])) as Record<(typeof projectHubIpcCases)[number]['method'], ReturnType<typeof vi.fn>>;
let exposed: Record<string, (...args: unknown[]) => Promise<unknown>>;
let invoke: ReturnType<typeof vi.fn<(channel: string, ...args: unknown[]) => Promise<unknown>>>;
beforeEach(() => {
  resetAuthStateForTests(); setAuthState({ authenticated: true, userId: 'usuario-ficticio' });
  Object.values(service).forEach(method => method.mockReset().mockResolvedValue({ success: true, data: [] }));
  service.getStatus.mockResolvedValue({ configured: true, authenticated: true, workspaces: [{ id: IPC_ID, name: 'Workspace comprobado' }] });
  service.getProject.mockResolvedValue({ success: true, data: { project_id: IPC_ID, workspace_id: IPC_ID, project_name: 'Proyecto comprobado' } });
  const sender = Object.assign(new EventEmitter(), { mainFrame: { url: pathToFileURL(path.join(app.getAppPath(), 'dist', 'index.html')).href }, isDestroyed: () => false });
  const event = { sender, senderFrame: sender.mainFrame } as unknown as IpcMainInvokeEvent;
  const win = { webContents: sender, isDestroyed: () => false } as unknown as BrowserWindow;
  registerProjectHubHandlers(service as unknown as ProjectHubApiService, () => win);
  vi.mocked(dialog.showMessageBox).mockResolvedValue({ response: 1, checkboxChecked: false });
  invoke = vi.fn((channel: string, ...args: unknown[]) => harness._getHandler(channel)(event, ...args));
  const ipc = createSafeIpc({ invoke, send: vi.fn(), on: vi.fn(), off: vi.fn(), removeAllListeners: vi.fn() });
  exposeProjectHubApi({ exposeInMainWorld: (key, value) => {
    expect(key).toBe('projectHubApi'); exposed = value as typeof exposed;
  } }, ipc);
  vi.stubGlobal('window', { projectHubApi: exposed });
});
afterEach(() => { resetAuthStateForTests(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('Preload/allowlist/handler Project Hub reales con servicio doble', () => {
  it.each(projectHubIpcCases)('transporta $method por su canal de dominio', async item => {
    expect(Object.keys(exposed)).toHaveLength(projectHubIpcCases.length + 15);
    expect(ALLOWED_IPC_CHANNELS).toContain('project-hub:' + item.channel);
    expect(await exposed[item.method](...(item.input === undefined ? [] : [item.input]))).toMatchObject({ success: true });
    expect(invoke.mock.calls[0][0]).toBe('project-hub:' + item.channel);
    expect(service[item.method]).toHaveBeenCalledOnce();
  });
  it('no expone transporte ni credenciales, y la allowlist bloquea un canal inventado', () => {
    expect(exposed).not.toHaveProperty('request'); expect(exposed).not.toHaveProperty('exchangeSofiaToken');
    const ipc = createSafeIpc({ invoke, send: vi.fn(), on: vi.fn(), off: vi.fn(), removeAllListeners: vi.fn() });
    expect(() => ipc.safeInvoke('project-hub:request', '/cualquiera')).toThrow(); expect(invoke).not.toHaveBeenCalled();
  });
});

describe('Wrapper renderer integrado con las cuatro capas', () => {
  it('conserva status y creación de proyecto sin publicar contexto main al renderer', async () => {
    expect(await projectHubApi.status()).toMatchObject({ success: true });
    expect(await projectHubApi.createProject(IPC_ID, { name: 'Proyecto ficticio' })).toMatchObject({ success: true });
    expect(invoke.mock.calls[1]).toEqual(['project-hub:create-project', { workspaceId: IPC_ID, project: { name: 'Proyecto ficticio' } }]);
    expect(service.createProject.mock.calls[0][1]).toMatchObject({ userId: 'usuario-ficticio' });
  });
  it('incluye el wrapper de actualización de tarea que faltaba', async () => {
    expect(await projectHubApi.updateTask(IPC_ID, IPC_ID, IPC_ID, { due_date: null })).toMatchObject({ success: true });
    expect(invoke.mock.calls[0][0]).toBe('project-hub:update-task'); expect(service.updateTask).toHaveBeenCalledOnce();
  });
  it('conserva cancelación e incertidumbre sin reinterpretar el sobre IPC', async () => {
    vi.mocked(dialog.showMessageBox).mockResolvedValueOnce({ response: 0, checkboxChecked: false });
    expect(await projectHubApi.createProject(IPC_ID, { name: 'Proyecto ficticio' })).toMatchObject({ cancelled: true });
    service.createProject.mockResolvedValueOnce({ success: false, code: 'TIMEOUT', error: 'Respuesta no confirmada.' });
    expect(await projectHubApi.createProject(IPC_ID, { name: 'Proyecto ficticio' })).toMatchObject({ uncertain: true, recoveryRequired: true });
  });
  it('falla explícitamente fuera del escritorio sin llamar IPC', async () => {
    vi.stubGlobal('window', {});
    expect(await projectHubApi.listProjects(IPC_ID)).toMatchObject({ code: 'DESKTOP_ONLY' }); expect(invoke).not.toHaveBeenCalled();
  });
});
