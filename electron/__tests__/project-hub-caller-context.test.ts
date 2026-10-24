import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectHubApiService } from '../project-hub/service';
import type { ProjectHubOperationAuthorization } from '../project-hub';
import { getAuthState, resetAuthStateForTests, setAuthState } from '../main/auth-state';
import { projectHubIpcCases } from './project-hub/ipc-cases';
import { credentials, deferred, tokenPair, workspace } from './project-hub/fixtures';

vi.mock('../main/sofia-session', () => ({ getSofiaSessionUserId: () => getAuthState().userId }));
const store = { load: vi.fn(), save: vi.fn(async () => {}), clear: vi.fn(async () => {}) };
beforeEach(() => { resetAuthStateForTests(); setAuthState({ authenticated: true, userId: 'usuario-ficticio' }); vi.clearAllMocks(); });
afterEach(() => { resetAuthStateForTests(); vi.unstubAllGlobals(); });

describe('Contexto explícito en todos los métodos Project Hub con payload', () => {
  it.each(projectHubIpcCases.filter(item => item.input !== undefined))('no envía $method después de cancelar caller durante captura', async item => {
    const fetch = vi.fn(async () => Response.json({ data: { ...tokenPair(), workspaces: [workspace()] } })); vi.stubGlobal('fetch', fetch);
    const service = new ProjectHubApiService('https://api.example.test', store);
    expect((await service.exchangeSofiaToken('sofia-ficticio')).success).toBe(true); fetch.mockClear();
    const controller = new AbortController();
    const authorization: ProjectHubOperationAuthorization = { userId: 'usuario-ficticio', signal: controller.signal, assertCurrent: () => {} };
    const method = service[item.method] as (input: unknown, auth: ProjectHubOperationAuthorization) => Promise<{ success: boolean; code?: string }>;
    const pending = method.call(service, item.input, authorization); controller.abort();
    expect(await pending).toMatchObject({ success: false, code: 'SESSION_CHANGED' }); expect(fetch).not.toHaveBeenCalled();
  });
  it('un caller con usuario distinto no inicia restore ni red', async () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    const service = new ProjectHubApiService('https://api.example.test', store);
    const result = await service.listProjects({ workspaceId: workspace().id }, { userId: 'otro', assertCurrent: () => {} });
    expect(result.code).toBe('SESSION_CHANGED'); expect(fetch).not.toHaveBeenCalled(); expect(store.load).not.toHaveBeenCalled();
  });
  it('retry-auth cancelado no hace canje ni afecta al estado vigente', async () => {
    const fetch = vi.fn(async () => Response.json({ data: { ...tokenPair(), workspaces: [workspace()] } })); vi.stubGlobal('fetch', fetch);
    const service = new ProjectHubApiService('https://api.example.test', store);
    await service.exchangeSofiaToken('sofia-ficticio'); fetch.mockClear();
    const controller = new AbortController(); controller.abort();
    expect((await service.retryAuthentication({ userId: 'usuario-ficticio', signal: controller.signal, assertCurrent: () => {} })).success).toBe(false);
    expect(fetch).not.toHaveBeenCalled(); expect((await service.getStatus()).authenticated).toBe(true);
  });
  it('libera al caller cancelado sin esperar un load de custodia pendiente', async () => {
    const loading = deferred<ReturnType<typeof credentials>>(); const started = deferred<void>();
    store.load.mockImplementationOnce(() => { started.resolve(); return loading.promise; });
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ data: tokenPair('renovado') })));
    const service = new ProjectHubApiService('https://api.example.test', store); const controller = new AbortController();
    const settled = vi.fn();
    const pending = service.listProjects({ workspaceId: workspace().id }, { userId: 'usuario-ficticio', signal: controller.signal, assertCurrent: () => {} });
    void pending.then(settled); await started.promise; controller.abort();
    try { await vi.waitFor(() => expect(settled).toHaveBeenCalled(), { timeout: 200 }); }
    finally { loading.resolve(credentials()); await pending; await service.restore(); }
    expect(settled.mock.calls[0][0]).toMatchObject({ success: false, code: 'SESSION_CHANGED' });
  });
});
