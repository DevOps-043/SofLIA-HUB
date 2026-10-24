import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getAuthState, resetAuthStateForTests, setAuthState } from '../main/auth-state';
import { ProjectHubApiService } from '../project-hub/service';
import type { ProjectHubSession } from '../project-hub/types';
const identity = vi.hoisted(() => ({ verified: undefined as string | null | undefined, read: vi.fn() }));
const log = vi.hoisted(() => ({ warn: vi.fn() }));
vi.mock('../main/sofia-session', () => ({ getSofiaSessionUserId: identity.read }));
vi.mock('../utils/logger', () => ({ createLogger: () => log }));

type Stored = Pick<ProjectHubSession, 'refreshToken' | 'workspaces'>;
const storage = vi.hoisted(() => ({
  read: vi.fn(), write: vi.fn(), clear: vi.fn(), ownedRead: vi.fn(), sessions: new Map<string, Stored>(),
}));
vi.mock('../project-hub/session-store', () => ({
  readProjectHubSession: storage.read, saveProjectHubSession: storage.write, clearProjectHubSession: storage.clear,
  ProjectHubSessionStore: class {
    async load(owner: string, assert = () => {}) { assert(); const stored = await storage.ownedRead(owner); assert(); return stored; }
    async save(owner: string, session: Stored, assert = () => {}) {
      assert(); storage.write(owner, session); storage.sessions.set(owner, session);
    }
    async clear(owner: string) { storage.clear(owner); storage.sessions.delete(owner); }
  },
}));

const workspace = (name = 'Proyecto de prueba') => ({ id: '12345678-1234-4123-8123-123456789012', name, slug: 'prueba', role: 'owner' });
const auth = (name = 'Proyecto de prueba') => ({
  access_token: `acceso-ficticio-${name.replace(/ /g, '_')}`.padEnd(48, 'x'),
  refresh_token: `renovacion-ficticia-${name.replace(/ /g, '_')}`.padEnd(48, 'x'), expires_in: 3600, workspaces: [workspace(name)],
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(accept => { resolve = accept; });
  return { promise, resolve };
}
const response = (data: unknown) => Response.json({ data });
const login = () => setAuthState({ authenticated: true, userId: 'A' });

beforeEach(() => {
  resetAuthStateForTests();
  identity.verified = undefined; log.warn.mockClear();
  identity.read.mockReset().mockImplementation(() => identity.verified === undefined ? getAuthState().userId : identity.verified);
  storage.read.mockReset().mockReturnValue(null);
  storage.write.mockReset(); storage.clear.mockReset(); storage.sessions.clear();
  storage.ownedRead.mockReset().mockImplementation((owner: string) => storage.sessions.get(owner) ?? null);
});
afterEach(() => { vi.unstubAllGlobals(); resetAuthStateForTests(); });

describe('Regresiones de identidad y recuperación Project Hub', () => {
  it('status anónimo no restaura el archivo global ni contacta al servidor', async () => {
    storage.read.mockReturnValue({ refreshToken: 'legado-ficticio', workspaces: [workspace()] });
    const fetch = vi.fn(async () => response(auth()));
    vi.stubGlobal('fetch', fetch);
    const service = new ProjectHubApiService('https://api.example.test');
    expect(await service.getStatus()).toMatchObject({ authenticated: false, workspaces: [] });
    expect(fetch).not.toHaveBeenCalled();
    expect(storage.read).not.toHaveBeenCalled();
  });

  it('un canje tardío no restaura memoria ni disco después del logout', async () => {
    login();
    const pending = deferred<Response>();
    const started = deferred<void>();
    vi.stubGlobal('fetch', vi.fn(() => { started.resolve(); return pending.promise; }));
    const service = new ProjectHubApiService('https://api.example.test');
    const exchange = service.exchangeSofiaToken('sofia-ficticio'.padEnd(48, 'x'));
    await started.promise;
    setAuthState({ authenticated: false, userId: null });
    await service.logout();
    pending.resolve(response(auth()));
    expect((await exchange).success).toBe(false);
    expect((await service.getStatus()).authenticated).toBe(false);
    expect(storage.write).not.toHaveBeenCalled();
  });

  it('un refresh tardío no vuelve a autenticar después de logout', async () => {
    login();
    const stored = { refreshToken: 'renovacion-previa-ficticia'.padEnd(48, 'x'), workspaces: [workspace()] };
    storage.read.mockReturnValue(stored); storage.sessions.set('A', stored);
    const pending = deferred<Response>();
    const started = deferred<void>();
    vi.stubGlobal('fetch', vi.fn(() => { started.resolve(); return pending.promise; }));
    const service = new ProjectHubApiService('https://api.example.test');
    const restoring = service.restore();
    await started.promise;
    setAuthState({ authenticated: false, userId: null });
    await service.logout();
    pending.resolve(response(auth()));
    expect(await restoring).toBe(false);
    expect((await service.getStatus()).authenticated).toBe(false);
    expect(storage.write).not.toHaveBeenCalled();
  });

  it('no reenvía una mutación tras recibir 401 aunque pueda renovar', async () => {
    login();
    let writes = 0;
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('/auth/')) return response(auth());
      writes++;
      return writes === 1 ? Response.json({ error: { code: 'UNAUTHORIZED', message: 'sesión vencida' } }, { status: 401 })
        : response({ project_id: 'resultado-ficticio' });
    }));
    const service = new ProjectHubApiService('https://api.example.test');
    expect((await service.exchangeSofiaToken('sofia-ficticio'.padEnd(48, 'x'))).success).toBe(true);
    const result = await service.createProject({ workspaceId: workspace().id, project: { project_name: 'Prueba' } });
    expect(result.success).toBe(false);
    expect(writes).toBe(1);
  });

  it('descarta respuestas de un contexto A-B-A aunque el usuario final coincida', async () => {
    login();
    const pending = deferred<Response>();
    const started = deferred<void>();
    vi.stubGlobal('fetch', vi.fn(() => { started.resolve(); return pending.promise; }));
    const service = new ProjectHubApiService('https://api.example.test');
    const exchange = service.exchangeSofiaToken('sofia-ficticio'.padEnd(48, 'x'));
    await started.promise;
    setAuthState({ authenticated: true, userId: 'B' }); login();
    pending.resolve(response(auth()));
    expect((await exchange).success).toBe(false);
    expect(getAuthState().userId).toBe('A');
    expect(storage.write).not.toHaveBeenCalled();
  });

  it('el canje anterior no sustituye la sesión de uno posterior', async () => {
    login();
    const first = deferred<Response>(); const second = deferred<Response>();
    const started = deferred<void>();
    vi.stubGlobal('fetch', vi.fn().mockImplementationOnce(() => { started.resolve(); return first.promise; }).mockReturnValueOnce(second.promise));
    const service = new ProjectHubApiService('https://api.example.test');
    const oldExchange = service.exchangeSofiaToken('sofia-anterior'.padEnd(48, 'x'));
    await started.promise;
    const newExchange = service.exchangeSofiaToken('sofia-actual'.padEnd(48, 'x'));
    second.resolve(response(auth('Nuevo')));
    expect((await newExchange).success).toBe(true);
    first.resolve(response(auth('Anterior')));
    expect((await oldExchange).success).toBe(false);
    expect((await service.getStatus()).workspaces[0].name).toBe('Nuevo');
  });

  it.each([null, 'B'])('un estado main sin identidad SOFIA coincidente no abre custodia: %s', async verified => {
    login(); identity.verified = verified;
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    storage.sessions.set('A', { refreshToken: 'credencial-ficticia', workspaces: [workspace()] });
    const service = new ProjectHubApiService('https://api.example.test');
    expect(await service.restore()).toBe(false);
    expect((await service.getStatus()).authenticated).toBe(false);
    expect((await service.exchangeSofiaToken('sofia-ficticio')).code).toBe('SOFIA_SESSION_PENDING');
    expect(storage.ownedRead).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
  });

  it('dos lecturas rechazadas comparten una renovación y usan su nuevo acceso', async () => {
    login();
    const pending = [deferred<Response>(), deferred<Response>()]; const bothSent = deferred<void>();
    const renewing = deferred<Response>(); const refreshStarted = deferred<void>();
    let reads = 0; let refreshes = 0;
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.endsWith('/exchange')) return response(auth());
      if (url.endsWith('/refresh')) { refreshes++; refreshStarted.resolve(); return renewing.promise; }
      const index = reads++;
      if (index === 1) bothSent.resolve();
      return index < 2 ? pending[index].promise : response([]);
    }));
    const service = new ProjectHubApiService('https://api.example.test');
    expect(await service.exchangeSofiaToken('sofia-ficticio')).toMatchObject({ success: true });
    const first = service.listProjects({ workspaceId: workspace().id });
    const second = service.listProjects({ workspaceId: workspace().id });
    const completed: unknown[] = [];
    void first.then(result => completed.push(result)); void second.then(result => completed.push(result));
    await vi.waitFor(() => expect(reads, JSON.stringify({ completed, verified: identity.read.mock.results.map(result => result.value) })).toBe(2));
    pending.forEach(waiting => waiting.resolve(Response.json({ error: {} }, { status: 401 })));
    await vi.waitFor(() => expect(refreshes, JSON.stringify(completed)).toBe(1)); renewing.resolve(response(auth('Renovado')));
    expect((await first).success).toBe(true); expect((await second).success).toBe(true);
    expect(refreshes).toBe(1); expect(reads).toBe(4);
  });

  it.each([true, false])('un refresh anterior no borra ni sustituye un canje nuevo: éxito=%s', async succeeds => {
    login(); const renewing = deferred<Response>(); const refreshStarted = deferred<void>();
    let exchanges = 0;
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.endsWith('/exchange')) return response(auth(exchanges++ ? 'Nuevo' : 'Anterior'));
      if (url.endsWith('/refresh')) { refreshStarted.resolve(); return renewing.promise; }
      return exchanges > 1 ? response([]) : Response.json({ error: {} }, { status: 401 });
    }));
    const service = new ProjectHubApiService('https://api.example.test');
    await service.exchangeSofiaToken('sofia-anterior');
    const reading = service.listProjects({ workspaceId: workspace().id }); await refreshStarted.promise;
    await service.exchangeSofiaToken('sofia-nuevo');
    renewing.resolve(succeeds ? response(auth('Renovado-viejo')) : Response.json({ error: {} }, { status: 401 }));
    expect((await reading).success).toBe(true);
    expect((await service.getStatus()).workspaces[0].name).toBe('Nuevo');
    expect(storage.sessions.get('A')?.workspaces[0].name).toBe('Nuevo');
  });

  it('logout cierra antes de esperar revocación y no borra un login posterior', async () => {
    login(); const revocation = deferred<Response>(); const logoutStarted = deferred<void>(); let exchanges = 0;
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.endsWith('/logout')) { logoutStarted.resolve(); return revocation.promise; }
      return response(auth(exchanges++ ? 'Nuevo' : 'Anterior'));
    }));
    const service = new ProjectHubApiService('https://api.example.test');
    await service.exchangeSofiaToken('sofia-anterior');
    setAuthState({ authenticated: false, userId: null });
    const loggingOut = service.logout(); await logoutStarted.promise;
    expect((await service.getStatus()).authenticated).toBe(false);
    login(); await service.exchangeSofiaToken('sofia-nuevo');
    revocation.resolve(response({ logged_out: true })); await loggingOut;
    expect((await service.getStatus()).workspaces[0].name).toBe('Nuevo');
    expect(storage.sessions.get('A')?.workspaces[0].name).toBe('Nuevo');
  });

  it('una lectura antigua de disco no renueva credenciales nuevas', async () => {
    login(); const pending = deferred<Stored>(); const started = deferred<void>();
    storage.ownedRead.mockImplementationOnce(() => { started.resolve(); return pending.promise; });
    let refreshes = 0;
    vi.stubGlobal('fetch', vi.fn(async (url: string) => { if (url.endsWith('/refresh')) refreshes++; return response(auth('Nuevo')); }));
    const service = new ProjectHubApiService('https://api.example.test');
    const restoring = service.restore(); await started.promise;
    await service.exchangeSofiaToken('sofia-nuevo');
    pending.resolve({ refreshToken: 'renovacion-antigua', workspaces: [workspace('Anterior')] });
    await restoring;
    expect(refreshes).toBe(0); expect((await service.getStatus()).workspaces[0].name).toBe('Nuevo');
  });

  it('un retry anterior no invalida un canje invocado después', async () => {
    login();
    vi.stubGlobal('fetch', vi.fn(async (_url: string, options: RequestInit) => {
      const body = JSON.parse(String(options.body)) as { sofia_access_token: string };
      return response(auth(body.sofia_access_token.includes('nuevo') ? 'Nuevo' : 'Anterior'));
    }));
    const service = new ProjectHubApiService('https://api.example.test');
    await service.exchangeSofiaToken('sofia-anterior');
    const retry = service.retryAuthentication(); const exchange = service.exchangeSofiaToken('sofia-nuevo');
    const result = await exchange;
    expect(result.success, JSON.stringify(result)).toBe(true); await retry;
    expect((await service.getStatus()).workspaces[0].name).toBe('Nuevo');
  });

  it('retry sin credencial cacheada no cancela el primer canje en verificación', async () => {
    login(); vi.stubGlobal('fetch', vi.fn(async () => response(auth())));
    const service = new ProjectHubApiService('https://api.example.test');
    const exchange = service.exchangeSofiaToken('sofia-ficticio');
    expect((await service.retryAuthentication()).code).toBe('SOFIA_SESSION_PENDING');
    expect((await exchange).success).toBe(true);
  });

  it('un fallo de persistencia mantiene memoria sin registrar excepción/credenciales', async () => {
    login(); storage.write.mockImplementationOnce(() => { throw new Error('secreto-ficticio-de-disco'); });
    vi.stubGlobal('fetch', vi.fn(async () => response(auth())));
    const service = new ProjectHubApiService('https://api.example.test');
    expect((await service.exchangeSofiaToken('sofia-ficticio')).success).toBe(true);
    expect((await service.getStatus()).authenticated).toBe(true);
    expect(JSON.stringify(log.warn.mock.calls)).not.toMatch(/secreto-ficticio|acceso-ficticio|renovacion-ficticia/);
  });

  it('una respuesta de negocio de A no se publica después de pasar a B', async () => {
    login(); const pending = deferred<Response>(); const started = deferred<void>();
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.endsWith('/exchange')) return response(auth());
      started.resolve(); return pending.promise;
    }));
    const service = new ProjectHubApiService('https://api.example.test');
    await service.exchangeSofiaToken('sofia-ficticio');
    const reading = service.listProjects({ workspaceId: workspace().id }); await started.promise;
    setAuthState({ authenticated: true, userId: 'B' });
    pending.resolve(response([{ nombre: 'Información ficticia exclusiva de A' }]));
    const result = await reading;
    expect(result.code).toBe('SESSION_CHANGED'); expect(result.data).toBeUndefined();
  });

  it('revalida la identidad SOFIA aunque main aún conserve el usuario anterior', async () => {
    login(); const pending = deferred<Response>(); const started = deferred<void>();
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.endsWith('/exchange')) return response(auth());
      started.resolve(); return pending.promise;
    }));
    const service = new ProjectHubApiService('https://api.example.test');
    await service.exchangeSofiaToken('sofia-ficticio');
    const reading = service.listProjects({ workspaceId: workspace().id }); await started.promise;
    identity.verified = 'B'; pending.resolve(response([{ nombre: 'Información exclusiva de A' }]));
    expect((await reading).code).toBe('SESSION_CHANGED');
  });

  it('no usa un acceso vencido si falla su renovación', async () => {
    login(); const now = Date.now(); const clock = vi.spyOn(Date, 'now').mockReturnValue(now);
    let businessRequests = 0;
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.endsWith('/exchange')) return response({ ...auth(), expires_in: 1 });
      if (url.endsWith('/refresh')) return Response.json({ error: {} }, { status: 503 });
      businessRequests++; return response([]);
    }));
    try {
      const service = new ProjectHubApiService('https://api.example.test');
      await service.exchangeSofiaToken('sofia-ficticio'); clock.mockReturnValue(now + 2000);
      expect((await service.listProjects({ workspaceId: workspace().id })).success).toBe(false);
      expect((await service.getStatus()).authenticated).toBe(false); expect(businessRequests).toBe(0);
    } finally { clock.mockRestore(); }
  });

  it.each([
    { ...auth(), refresh_token: '' }, { ...auth(), access_token: 'con\r\ncontrol' },
    { ...auth(), expires_in: 0 }, { ...auth(), workspaces: 'incorrecto' },
  ])('rechaza credenciales malformadas del canje: %#', async data => {
    login(); vi.stubGlobal('fetch', vi.fn(async () => response(data)));
    const service = new ProjectHubApiService('https://api.example.test');
    expect((await service.exchangeSofiaToken('sofia-ficticio')).code).toBe('INVALID_RESPONSE');
    expect(storage.write).not.toHaveBeenCalled();
  });
});
