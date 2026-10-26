import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { app, dialog, ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import { registerProjectCreationHandlers } from '../project-hub/creation-handlers';
import { resetAuthStateForTests, setAuthState } from '../main/auth-state';
import { exposeProjectHubApi } from '../preload/project-hub-api';
import { createSafeIpc } from '../preload/safe-ipc';
import { projectHubApi } from '../../src/services/project-hub-api';
import type { ProjectHubApiService } from '../project-hub/service';

const fixtures = vi.hoisted(() => ({ resolve: vi.fn(), select: vi.fn(), create: vi.fn(), location: vi.fn(), cloudCreate: vi.fn() }));
vi.mock('../project-hub/cloud-storage', () => ({ createProjectCloudStorage: () => ({ storage: { createFolder: fixtures.cloudCreate } }) }));
vi.mock('../project-hub/organization', () => ({ resolveProjectOrganization: fixtures.resolve }));
vi.mock('../project-hub/project-creation', () => ({ ProjectCreationService: class { selectFolder = fixtures.select; create = fixtures.create; location = fixtures.location; } }));
const id = randomUUID();
let event: IpcMainInvokeEvent;
let window: BrowserWindow;
const handler = (channel: string) => (ipcMain as unknown as { _getHandler: (channel: string) => (event: IpcMainInvokeEvent, ...input: unknown[]) => Promise<unknown> })._getHandler(channel);
beforeEach(() => {
  vi.clearAllMocks(); resetAuthStateForTests(); setAuthState({ authenticated: true, userId: 'usuario-qa' });
  const sender = Object.assign(new EventEmitter(), { mainFrame: { url: pathToFileURL(path.join(app.getAppPath(), 'dist', 'index.html')).href }, isDestroyed: () => false });
  window = { webContents: sender, isDestroyed: () => false } as unknown as BrowserWindow;
  event = { sender, senderFrame: sender.mainFrame } as unknown as IpcMainInvokeEvent;
  fixtures.resolve.mockResolvedValue({ workspaceId: id, name: 'Empresa', role: 'owner' });
  vi.mocked(dialog.showOpenDialog).mockResolvedValue({ canceled: false, filePaths: ['C:\\Proyectos'] });
  fixtures.select.mockResolvedValue({ selectionId: id, path: 'C:\\Proyectos', folders: [] });
  fixtures.create.mockResolvedValue({ success: true, data: { project_id: id, workspace_id: id } });
  fixtures.location.mockResolvedValue({ mode: 'cloud', additionalFolders: [] });
  fixtures.cloudCreate.mockResolvedValue({ provider: 'google_drive', selectionId: id, accountEmail: 'demo@example.test', name: 'Referencias' });
  registerProjectCreationHandlers({} as ProjectHubApiService, () => [window]);
});
afterEach(() => { resetAuthStateForTests(); vi.unstubAllGlobals(); });

describe('Contrato completo de creación configurada', () => {
  it('crear carpeta recorre las cuatro capas y rechaza nombres con rutas', async () => {
    const invoke = vi.fn((channel: string, ...input: unknown[]) => handler(channel)(event, ...input));
    const ipc = createSafeIpc({ invoke, send: vi.fn(), on: vi.fn(), off: vi.fn(), removeAllListeners: vi.fn() });
    let bridge: unknown; exposeProjectHubApi({ exposeInMainWorld: (_key, value) => { bridge = value; } }, ipc);
    vi.stubGlobal('window', { projectHubApi: bridge });
    const input = { provider: 'google_drive' as const, selectionId: id, operationId: id, name: 'Referencias' };
    expect(await projectHubApi.createCloudFolder(input)).toMatchObject({ success: true, data: { name: 'Referencias' } });
    expect(fixtures.cloudCreate).toHaveBeenCalledWith(input, expect.objectContaining({ userId: 'usuario-qa' }));
    expect(await projectHubApi.createCloudFolder({ ...input, name: '../privado' })).toMatchObject({ code: 'INVALID_PAYLOAD' });
    expect(fixtures.cloudCreate).toHaveBeenCalledOnce();
  });
  it('recorre wrapper, preload, allowlist, handler y servicio sin ventana adicional', async () => {
    const invoke = vi.fn((channel: string, ...input: unknown[]) => handler(channel)(event, ...input));
    const ipc = createSafeIpc({ invoke, send: vi.fn(), on: vi.fn(), off: vi.fn(), removeAllListeners: vi.fn() });
    let bridge: unknown;
    exposeProjectHubApi({ exposeInMainWorld: (_key, value) => { bridge = value; } }, ipc);
    vi.stubGlobal('window', { projectHubApi: bridge });
    expect(await projectHubApi.resolveOrganization(id)).toMatchObject({ success: true, data: { workspaceId: id } });
    expect(await projectHubApi.selectFolder()).toMatchObject({ success: true });
    expect(dialog.showOpenDialog).toHaveBeenCalledWith(window, expect.objectContaining({ properties: ['openDirectory', 'createDirectory'], buttonLabel: 'Usar esta carpeta' }));
    const input = { operationId: id, organizationId: id, name: 'Nuevo', storage: { mode: 'local' as const, parentSelectionId: id }, additionalSelectionIds: [] };
    expect(await projectHubApi.createConfigured(input)).toMatchObject({ success: true });
    expect(await projectHubApi.getLocation({ workspaceId: id, projectId: id })).toMatchObject({ success: true });
    expect(fixtures.create).toHaveBeenCalledWith(input, expect.objectContaining({ userId: 'usuario-qa', assertCurrent: expect.any(Function) }));
    expect(invoke.mock.calls.map(call => call[0])).toEqual(['project-hub:resolve-organization', 'project-hub:select-folder', 'project-hub:create-configured', 'project-hub:get-location']);
  });
  it.each(['sesión', 'subframe', 'origen', 'ventana'])('deniega contexto inválido antes de usar el servicio: %s', async mode => {
    if (mode === 'sesión') setAuthState({ authenticated: false, userId: null });
    if (mode === 'subframe') event = { ...event, senderFrame: {} } as IpcMainInvokeEvent;
    if (mode === 'origen') Object.assign(event.senderFrame!, { url: 'https://externo.test' });
    if (mode === 'ventana') registerProjectCreationHandlers({} as ProjectHubApiService, () => []);
    expect(await handler('project-hub:resolve-organization')(event, { organizationId: id })).toMatchObject({ success: false });
    expect(fixtures.resolve).not.toHaveBeenCalled();
  });
  it('rechaza IDs, rutas inyectadas, autoridad ajena y argumentos extra', async () => {
    expect(await handler('project-hub:select-folder')(event, {}, 'extra')).toMatchObject({ code: 'INVALID_PAYLOAD' });
    expect(await handler('project-hub:resolve-organization')(event, { organizationId: 'inválido' })).toMatchObject({ code: 'INVALID_PAYLOAD' });
    expect(await handler('project-hub:create-configured')(event, { operationId: id, organizationId: id, workspaceId: id, name: 'x', storage: { mode: 'local', path: 'C:\\otra' }, additionalSelectionIds: [] })).toMatchObject({ code: 'INVALID_PAYLOAD' });
    expect(fixtures.create).not.toHaveBeenCalled();
    expect(fixtures.select).not.toHaveBeenCalled();
  });
});
