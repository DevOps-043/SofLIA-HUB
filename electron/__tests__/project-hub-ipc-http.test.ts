import { EventEmitter } from 'node:events';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { app, dialog, ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import { registerProjectHubHandlers } from '../project-hub-handlers';
import { ProjectHubApiService } from '../project-hub/service';
import { getAuthState, resetAuthStateForTests, setAuthState } from '../main/auth-state';
import { credentials, deferred, tokenPair, workspace, WORKSPACE_ID } from './project-hub/fixtures';

vi.mock('../main/sofia-session', () => ({ getSofiaSessionUserId: () => getAuthState().userId }));
const harness = ipcMain as unknown as { _getHandler(channel: string): (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<Record<string, unknown>> };
let base: string, mode = '';
let started = deferred<void>(), closed = deferred<void>(), releaseRefresh = deferred<void>();
const seen: { route: string; method?: string }[] = [];
const server = createServer(async (request, response) => {
  for await (const chunk of request) { void chunk; /* Consumir el cuerpo ficticio sin registrarlo. */ }
  const route = request.url!; seen.push({ route, method: request.method });
  response.setHeader('content-type', 'application/json'); response.setHeader('connection', 'close');
  if (route.endsWith('/exchange')) { response.end(JSON.stringify({ data: { ...tokenPair(), workspaces: [workspace()] } })); return; }
  if (route.endsWith('/refresh')) {
    if (mode === 'single-flight') { started.resolve(); await releaseRefresh.promise; }
    response.end(JSON.stringify({ data: tokenPair('renovado') })); return;
  }
  if (mode === 'hold' && request.method === 'POST') { response.once('close', () => closed.resolve()); started.resolve(); return; }
  if (mode === 'single-flight' && request.headers.authorization === 'Bearer ' + tokenPair().access_token) {
    response.writeHead(401); response.end(JSON.stringify({ error: {} })); return;
  }
  if (route.includes('/projects/')) { response.end(JSON.stringify({ data: { project_id: WORKSPACE_ID, workspace_id: WORKSPACE_ID, project_name: 'Proyecto comprobado' } })); return; }
  response.end(JSON.stringify({ data: [] }));
});
beforeAll(async () => {
  await new Promise<void>(resolve => { server.listen(0, '127.0.0.1', resolve); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
beforeEach(() => { vi.clearAllMocks(); seen.length = 0; mode = ''; started = deferred<void>(); closed = deferred<void>(); releaseRefresh = deferred<void>(); resetAuthStateForTests(); setAuthState({ authenticated: true, userId: 'usuario-ficticio' }); });
afterEach(() => { resetAuthStateForTests(); vi.restoreAllMocks(); });
afterAll(async () => {
  server.closeAllConnections(); await new Promise<void>(resolve => { server.close(() => resolve()); });
});
function caller() {
  const sender = Object.assign(new EventEmitter(), { mainFrame: { url: pathToFileURL(path.join(app.getAppPath(), 'dist', 'index.html')).href }, isDestroyed: () => false });
  const win = { webContents: sender, isDestroyed: () => false } as unknown as BrowserWindow;
  return { sender, win, event: { sender, senderFrame: sender.mainFrame } as unknown as IpcMainInvokeEvent };
}
const memoryStore = () => ({ load: vi.fn(async () => credentials()), save: vi.fn(async () => {}), clear: vi.fn(async () => {}) });

describe('Caller IPC hasta HTTP real en loopback', () => {
  it('navegar aborta un POST pendiente sin publicar datos ni prometer rollback', async () => {
    const service = new ProjectHubApiService(base, memoryStore());
    await service.exchangeSofiaToken('sofia-ficticio');
    const current = caller(); registerProjectHubHandlers(service, () => current.win);
    vi.mocked(dialog.showMessageBox).mockResolvedValue({ response: 1, checkboxChecked: false }); mode = 'hold';
    const pending = harness._getHandler('project-hub:create-project')(current.event, { workspaceId: WORKSPACE_ID, project: { name: 'Proyecto ficticio' } });
    await started.promise; current.sender.emit('did-start-navigation', {}, current.sender.mainFrame.url, false, true);
    expect(await pending).toMatchObject({ success: false, uncertain: true, recoveryRequired: true });
    await closed.promise; expect(seen.filter(item => item.method === 'POST' && item.route.endsWith('/projects'))).toHaveLength(1);
    expect(current.sender.eventNames()).toEqual([]);
  });
  it('navegar durante load impide enviar negocio después de renovar credenciales', async () => {
    const loading = deferred<ReturnType<typeof credentials>>();
    const store = memoryStore(); store.load.mockImplementationOnce(() => { started.resolve(); return loading.promise; });
    const service = new ProjectHubApiService(base, store); const current = caller(); registerProjectHubHandlers(service, () => current.win);
    vi.mocked(dialog.showMessageBox).mockResolvedValue({ response: 1, checkboxChecked: false });
    const pending = harness._getHandler('project-hub:create-project')(current.event, { workspaceId: WORKSPACE_ID, project: { name: 'Proyecto ficticio' } });
    await started.promise; current.sender.emit('did-start-navigation', {}, current.sender.mainFrame.url, false, true); loading.resolve(credentials());
    expect(await pending).toMatchObject({ success: false });
    await service.restore();
    expect(seen.map(item => item.route)).toEqual(['/api/v1/auth/refresh']); expect(current.sender.eventNames()).toEqual([]);
  });
  it('cancelar una lectura no cancela la renovación compartida con una operación interna', async () => {
    const service = new ProjectHubApiService(base, memoryStore()); await service.exchangeSofiaToken('sofia-ficticio'); mode = 'single-flight';
    const controller = new AbortController();
    const first = service.listProjects({ workspaceId: WORKSPACE_ID }, { userId: 'usuario-ficticio', signal: controller.signal, assertCurrent: () => {} });
    const second = service.listProjects({ workspaceId: WORKSPACE_ID });
    await started.promise; controller.abort(); releaseRefresh.resolve();
    expect((await first).success).toBe(false); expect((await second).success).toBe(true);
    expect(seen.filter(item => item.route.endsWith('/refresh'))).toHaveLength(1);
  });
});
