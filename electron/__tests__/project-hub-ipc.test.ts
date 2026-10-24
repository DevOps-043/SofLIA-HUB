import { EventEmitter } from 'node:events';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { app, dialog, ipcMain, type BrowserWindow, type IpcMainInvokeEvent, type MessageBoxOptions } from 'electron';
import { registerProjectHubHandlers } from '../project-hub-handlers';
import type { ProjectHubApiService } from '../project-hub';
import { resetAuthStateForTests, setAuthState } from '../main/auth-state';
import { projectHubIpcCases } from './project-hub/ipc-cases';
import { deferred } from './project-hub/fixtures';
import { IPC_APPROVAL_MS } from '../ipc/caller-authorization';

const ID = '12345678-1234-4123-8123-123456789012';
const harness = ipcMain as unknown as { _getHandler(channel: string): (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<Record<string, unknown>> };
const service = Object.fromEntries(projectHubIpcCases.map(item => [item.method, vi.fn()])) as Record<(typeof projectHubIpcCases)[number]['method'], ReturnType<typeof vi.fn>>;
let sender: EventEmitter & { id: number; mainFrame: { url: string }; isDestroyed(): boolean };
let win: BrowserWindow | null;
let event: IpcMainInvokeEvent;
const register = (provider = true) => registerProjectHubHandlers(service as unknown as ProjectHubApiService, provider ? () => win : undefined);
const invoke = (channel: string, ...args: unknown[]) => harness._getHandler('project-hub:' + channel)(event, ...args);
beforeEach(() => {
  vi.clearAllMocks(); Object.values(service).forEach(method => method.mockReset().mockResolvedValue({ success: true, data: [] }));
  resetAuthStateForTests(); setAuthState({ authenticated: true, userId: 'usuario-ficticio' });
  sender = Object.assign(new EventEmitter(), { id: 111, mainFrame: { url: pathToFileURL(path.join(app.getAppPath(), 'dist', 'index.html')).href }, isDestroyed: () => false });
  win = { webContents: sender, isDestroyed: () => false } as unknown as BrowserWindow;
  event = { sender, senderFrame: sender.mainFrame } as unknown as IpcMainInvokeEvent;
  service.getStatus.mockResolvedValue({ authenticated: true, configured: true, workspaces: [{ id: ID, name: 'Workspace comprobado' }] });
  service.getProject.mockResolvedValue({ success: true, data: { project_id: ID, workspace_id: ID, project_name: 'Proyecto comprobado' } });
  service.listProjects.mockResolvedValue({ success: true, data: [] });
  service.createProject.mockResolvedValue({ success: true, data: { project_id: ID } });
  vi.mocked(dialog.showMessageBox).mockResolvedValue({ response: 0, checkboxChecked: false });
  register();
});
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); resetAuthStateForTests(); });

describe('Autorización IPC Project Hub', () => {
  it.each(['proveedor', 'ventana', 'subframe', 'origen', 'sesión', 'frame separado'])('deniega %s ausente o inválido antes de leer', async mode => {
    if (mode === 'proveedor') register(false);
    if (mode === 'ventana') win = null;
    if (mode === 'subframe') event = { ...event, senderFrame: {} } as IpcMainInvokeEvent;
    if (mode === 'origen') sender.mainFrame.url = 'https://externo.example.test/';
    if (mode === 'sesión') setAuthState({ authenticated: false, userId: null });
    if (mode === 'frame separado') Object.assign(sender.mainFrame, { detached: true });
    expect(await invoke('list-projects', { workspaceId: ID })).toMatchObject({ success: false });
    expect(service.listProjects).not.toHaveBeenCalled();
  });
  it('rechaza argumentos de más en status y lectura', async () => {
    expect(await invoke('status', 'extra')).toMatchObject({ success: false });
    expect(await invoke('list-projects', { workspaceId: ID }, 'extra')).toMatchObject({ success: false });
    expect(service.getStatus).not.toHaveBeenCalled(); expect(service.listProjects).not.toHaveBeenCalled();
  });
  it('cancelar confirmación nativa no crea un proyecto', async () => {
    expect(await invoke('create-project', { workspaceId: ID, project: { name: 'Proyecto ficticio' } })).toMatchObject({ success: false });
    expect(dialog.showMessageBox).toHaveBeenCalledOnce(); expect(service.createProject).not.toHaveBeenCalled();
  });
  it('rechaza campos ajenos del proyecto antes de confirmar', async () => {
    expect(await invoke('create-project', { workspaceId: ID, project: { name: 'Proyecto ficticio', access_token: 'no-permitido-ficticio' } })).toMatchObject({ success: false });
    expect(dialog.showMessageBox).not.toHaveBeenCalled(); expect(service.createProject).not.toHaveBeenCalled();
  });
  it.each(projectHubIpcCases)('conserva contrato válido y aprobación de $channel', async item => {
    vi.mocked(dialog.showMessageBox).mockResolvedValue({ response: 1, checkboxChecked: false });
    const result = await invoke(item.channel, ...(item.input === undefined ? [] : [item.input]));
    expect(result).toMatchObject({ success: true }); expect(service[item.method]).toHaveBeenCalledOnce();
    expect(dialog.showMessageBox).toHaveBeenCalledTimes(item.mutation ? 1 : 0);
    const args = service[item.method].mock.calls[0];
    const auth = args[args.length - 1];
    expect(auth).toMatchObject({ userId: 'usuario-ficticio', assertCurrent: expect.any(Function), signal: expect.any(AbortSignal) });
    expect(auth.signal.aborted).toBe(true);
    expect(sender.eventNames()).toEqual([]);
  });
  it.each(projectHubIpcCases)('rechaza aridad extra sin servicio ni diálogo: $channel', async item => {
    expect(await invoke(item.channel, ...(item.input === undefined ? [] : [item.input]), 'extra')).toMatchObject({ code: 'INVALID_PAYLOAD' });
    expect(service[item.method]).not.toHaveBeenCalled(); expect(dialog.showMessageBox).not.toHaveBeenCalled();
  });
  it.each(projectHubIpcCases.filter(item => item.mutation))('cancelar $channel impide su mutación', async item => {
    expect(await invoke(item.channel, item.input)).toMatchObject({ cancelled: true });
    expect(service[item.method]).not.toHaveBeenCalled();
  });
  it('congela la selección antes de esperar la aprobación', async () => {
    const input = { workspaceId: ID, project: { name: 'Nombre aprobado', tags: ['original'] } };
    vi.mocked(dialog.showMessageBox).mockImplementationOnce(async () => {
      input.project.name = 'Nombre alterado'; input.project.tags.push('oculto');
      return { response: 1, checkboxChecked: false };
    });
    expect(await invoke('create-project', input)).toMatchObject({ success: true });
    expect(service.createProject.mock.calls[0][0].project).toEqual({ name: 'Nombre aprobado', tags: ['original'] });
  });
  it.each(['logout', 'A/B/A', 'navegación', 'destrucción', 'proceso', 'marco', 'registro'])('invalida confirmación tras %s', async mode => {
    vi.mocked(dialog.showMessageBox).mockImplementationOnce(async () => {
      if (mode === 'logout' || mode === 'A/B/A') {
        setAuthState({ authenticated: false, userId: null });
        if (mode === 'A/B/A') setAuthState({ authenticated: true, userId: 'usuario-ficticio' });
      }
      if (mode === 'navegación') sender.emit('did-start-navigation', {}, sender.mainFrame.url, false, true);
      if (mode === 'destrucción') sender.emit('destroyed');
      if (mode === 'proceso') sender.emit('render-process-gone');
      if (mode === 'marco') sender.mainFrame = { url: sender.mainFrame.url };
      if (mode === 'registro') win = null;
      return { response: 1, checkboxChecked: false };
    });
    expect(await invoke('create-project', { workspaceId: ID, project: { name: 'Proyecto ficticio' } })).toMatchObject({ success: false });
    expect(service.createProject).not.toHaveBeenCalled(); expect(sender.eventNames()).toEqual([]);
  });
  it('bloquea otro diálogo hasta cerrar el vencido y rechaza aceptación tardía', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    const response = deferred<{ response: number; checkboxChecked: boolean }>(); const started = deferred<void>();
    vi.mocked(dialog.showMessageBox).mockImplementationOnce(() => { started.resolve(); return response.promise; });
    const input = { workspaceId: ID, project: { name: 'Proyecto ficticio' } };
    const pending = invoke('create-project', input); await started.promise;
    await vi.advanceTimersByTimeAsync(IPC_APPROVAL_MS);
    expect(await pending).toMatchObject({ success: false });
    expect(await invoke('create-project', input)).toMatchObject({ success: false });
    expect(dialog.showMessageBox).toHaveBeenCalledOnce(); response.resolve({ response: 1, checkboxChecked: false });
    await Promise.resolve(); await Promise.resolve(); expect(service.createProject).not.toHaveBeenCalled();
    expect(sender.eventNames()).toEqual([]); expect(vi.getTimerCount()).toBe(0);
  });
  it.each([true, false])('descarta resultado anterior y conserva incertidumbre sólo de mutación: %s', async mutation => {
    const waiting = deferred<unknown>(); const started = deferred<void>();
    const method = mutation ? service.createProject : service.listProjects;
    method.mockImplementationOnce(() => { started.resolve(); return waiting.promise; });
    vi.mocked(dialog.showMessageBox).mockResolvedValue({ response: 1, checkboxChecked: false });
    const pending = invoke(mutation ? 'create-project' : 'list-projects', mutation ? { workspaceId: ID, project: { name: 'Proyecto ficticio' } } : { workspaceId: ID });
    await started.promise; sender.emit('did-start-navigation', {}, sender.mainFrame.url, false, true);
    waiting.resolve({ success: true, data: { privado: 'contenido-ficticio-anterior' } });
    const result = await pending; expect(result.success).toBe(false); expect(result.data).toBeUndefined();
    expect(result.uncertain).toBe(mutation ? true : undefined); expect(sender.eventNames()).toEqual([]);
  });
  it('una excepción inesperada no filtra texto sensible ni se interpreta como rollback', async () => {
    vi.mocked(dialog.showMessageBox).mockResolvedValue({ response: 1, checkboxChecked: false });
    service.createProject.mockRejectedValueOnce(new Error('secreto-ficticio-no-publicar'));
    const result = await invoke('create-project', { workspaceId: ID, project: { name: 'Proyecto ficticio' } });
    expect(result).toMatchObject({ success: false, uncertain: true, recoveryRequired: true });
    expect(JSON.stringify(result)).not.toContain('secreto-ficticio');
  });
  it.each(['sesión no verificada', 'workspace ausente', 'proyecto ausente', 'id distinto', 'workspace distinto', 'nombre inválido'])('no confirma destino sin comprobar: %s', async mode => {
    if (mode === 'sesión no verificada') service.getStatus.mockResolvedValueOnce({ authenticated: false, workspaces: [] });
    if (mode === 'workspace ausente') service.getStatus.mockResolvedValueOnce({ authenticated: true, workspaces: [] });
    if (mode === 'proyecto ausente') service.getProject.mockResolvedValueOnce({ success: false });
    if (mode === 'id distinto') service.getProject.mockResolvedValueOnce({ success: true, data: { project_id: crypto.randomUUID(), workspace_id: ID, project_name: 'Ajeno' } });
    if (mode === 'workspace distinto') service.getProject.mockResolvedValueOnce({ success: true, data: { project_id: ID, workspace_id: crypto.randomUUID(), project_name: 'Ajeno' } });
    if (mode === 'nombre inválido') service.getProject.mockResolvedValueOnce({ success: true, data: { project_id: ID, workspace_id: ID, project_name: '' } });
    expect(await invoke('update-project', { workspaceId: ID, projectId: ID, updates: { status: 'archived' } })).toMatchObject({ success: false });
    expect(dialog.showMessageBox).not.toHaveBeenCalled(); expect(service.updateProject).not.toHaveBeenCalled();
  });
  it('muestra nombres comprobados, rol y destinatario exactos en la confirmación', async () => {
    vi.mocked(dialog.showMessageBox).mockResolvedValueOnce({ response: 1, checkboxChecked: false });
    await invoke('add-member', { workspaceId: ID, projectId: ID, userId: ID, role: 'owner' });
    const options = (vi.mocked(dialog.showMessageBox).mock.calls as unknown as [BrowserWindow, MessageBoxOptions][])[0][1];
    expect(options).toMatchObject({ defaultId: 0, cancelId: 0 });
    expect(options.detail).toContain('Workspace comprobado'); expect(options.detail).toContain('Proyecto comprobado');
    expect(options.detail).toContain('usuario-ficticio'); expect(options.detail).toContain('owner'); expect(options.detail).toContain(ID);
  });
});

describe('Escrituras sin resultado verificable del servidor',()=>{it('un HTTP 500 posterior a la escritura exige revisar antes de repetir',async()=>{vi.mocked(dialog.showMessageBox).mockResolvedValue({response:1,checkboxChecked:false});service.createTask.mockResolvedValueOnce({success:false,code:'HTTP_500',error:'Servidor no disponible'});expect(await invoke('create-task',{workspaceId:ID,projectId:ID,task:{title:'Tarea ficticia'}})).toMatchObject({success:false,uncertain:true,recoveryRequired:true});expect(service.createTask).toHaveBeenCalledOnce();});});
