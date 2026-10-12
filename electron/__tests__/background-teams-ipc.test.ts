import { afterEach, describe, expect, it, vi } from 'vitest';
import { ipcMain } from 'electron';
import type { IpcMainInvokeEvent, BrowserWindow } from 'electron';
import type { BackgroundTeamService } from '../background-teams/service';
import { registerBackgroundTeamHandlers } from '../background-teams/handlers';
import { exposeBackgroundTeamsApi } from '../preload/background-teams-api';
import { ALLOWED_IPC_CHANNELS } from '../preload/channels';

afterEach(() => { vi.restoreAllMocks(); });
describe('IPC de equipos ejecutores', () => {
  function fixture() {
    const handlers = new Map<string, (...args: unknown[]) => Promise<unknown>>();
    vi.mocked(ipcMain.handle).mockImplementation((channel, handler) => { handlers.set(channel, handler as (...args: unknown[]) => Promise<unknown>); });
    let token = 1;
    const frame = {}; const contents = { mainFrame: frame, send: vi.fn() };
    const window = { isDestroyed: () => false, webContents: contents } as unknown as BrowserWindow;
    const service = { contextToken: () => token, authorize: vi.fn(async () => {}), context: vi.fn(async () => ({ scope: {} })),
      state: vi.fn(() => ({ jobs: [] })), start: vi.fn(async () => ({ id: 'job' })), control: vi.fn(async () => ({ id: 'job' })),
      invalidate: vi.fn(), attachLegacy: vi.fn(), artifactFile: vi.fn(), on: vi.fn(), off: vi.fn() } as unknown as BackgroundTeamService;
    const close = registerBackgroundTeamHandlers(service, () => window);
    const event = { sender: contents, senderFrame: frame } as unknown as IpcMainInvokeEvent;
    return { service, close, event, invoke: (name: string, payload?: unknown, caller = event) => handlers.get(name)!(caller, payload), changeContext: () => { token++; } };
  }
  it('rechaza subframes, ventanas ajenas y payloads con identidades inyectadas', async () => {
    const test = fixture();
    expect(await test.invoke('background-teams:state', undefined, { ...test.event, senderFrame: {} } as IpcMainInvokeEvent)).toMatchObject({ success: false });
    expect(await test.invoke('background-teams:context', { organizationId: null, userId: 'ajeno' })).toMatchObject({ success: false });
    expect(test.service.context).not.toHaveBeenCalled(); test.close();
  });
  it('no devuelve resultados anteriores después de un cambio de contexto', async () => {
    const test = fixture();
    vi.mocked(test.service.start).mockImplementation(async () => { test.changeContext(); return {} as never; });
    expect(await test.invoke('background-teams:start', { requestId: '4bc25420-46e1-4a93-9886-faf34152758a', messageId: '4bc25420-46e1-4a93-9886-faf34152758a', conversationId: 'chat', task: 'Crear documento', source: '', model: 'gemini-3.8-flash', effort: 'medium', allowResearch: false, expectedOwnerId: 'actor', expectedOrganizationId: null })).toMatchObject({ success: false });
    test.close();
  });
  it('expone solo operaciones cerradas y elimina listeners', () => {
    const invoke = vi.fn(); const remove = vi.fn(); const on = vi.fn(() => remove);
    const expose = vi.fn();
    exposeBackgroundTeamsApi({ exposeInMainWorld: expose }, { safeInvoke: invoke, safeOn: on } as never);
    const api = expose.mock.calls[0][1];
    api.control({ jobId: 'id', action: 'pause' }); const unsubscribe = api.onChanged(() => {}); unsubscribe();
    expect(invoke).toHaveBeenCalledWith('background-teams:control', { jobId: 'id', action: 'pause' });
    expect(remove).toHaveBeenCalledOnce();
    for (const action of ['context', 'release', 'state', 'start', 'control', 'open', 'changed']) expect(ALLOWED_IPC_CHANNELS).toContain('background-teams:' + action);
    expect(ALLOWED_IPC_CHANNELS).not.toContain('background-teams:execute-shell');
  });
});

