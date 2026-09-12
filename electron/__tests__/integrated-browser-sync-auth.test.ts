import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBrowserSyncConnection, readBrowserSyncClaims } from '../integrated-browser/sync-auth';
import { abortableSync, type BrowserSyncAuth } from '../integrated-browser/sync-remote';

type AuthSession = { access_token: string };
type SessionResult = { data: { session: AuthSession | null }; error: Error | null };
type AuthListener = (event: string, session: AuthSession | null) => void;
const mocks = vi.hoisted(() => ({
  getClient: vi.fn(), getOwner: vi.fn(), getSession: vi.fn<() => Promise<SessionResult>>(),
  onAuthStateChange: vi.fn<(listener: AuthListener) => { data: { subscription: { unsubscribe: () => void } } }>(),
  unsubscribe: vi.fn(), construct: vi.fn<(auth: BrowserSyncAuth, guard: () => void) => void>(),
  verify: vi.fn<(signal: AbortSignal) => Promise<void>>(),
}));
vi.mock('../hub-db-client', () => ({ getHubDbClient: mocks.getClient }));
vi.mock('../main/hub-session', () => ({ getHubSessionUserId: mocks.getOwner }));
vi.mock('../integrated-browser/sync-remote', async (original) => ({
  ...await original<typeof import('../integrated-browser/sync-remote')>(),
  BrowserSyncRemote: class {
    constructor(auth: BrowserSyncAuth, private readonly guard: () => void) { mocks.construct(auth, guard); }
    verify(signal: AbortSignal) { this.guard(); return mocks.verify(signal); }
  },
}));

const ownerId = '11111111-1111-4111-8111-111111111111';
const sessionId = '22222222-2222-4222-8222-222222222222';
const otherId = '33333333-3333-4333-8333-333333333333';
const origin = 'https://fixture.supabase.co';
const claims = () => ({ sub: ownerId, session_id: sessionId, iss: `${origin}/auth/v1`, role: 'authenticated', is_anonymous: false, exp: Math.floor(Date.now() / 1000) + 300 });
const token = (extra: object = {}) => `e30.${Buffer.from(JSON.stringify({ ...claims(), ...extra })).toString('base64url')}.firma-ficticia`;
const sessionResult = (accessToken = token()): SessionResult => ({ data: { session: { access_token: accessToken } }, error: null });
const signal = () => new AbortController().signal;
const guard = () => undefined;
function listener(): AuthListener { return mocks.onAuthStateChange.mock.calls[0][0]; }
function sessionGuard(): () => void { return mocks.construct.mock.calls[0][1]; }
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('VITE_SUPABASE_URL', `${origin}/`);
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'clave-publica-ficticia');
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('La prueba no permite red')));
  mocks.getClient.mockReturnValue({ auth: { getSession: mocks.getSession, onAuthStateChange: mocks.onAuthStateChange } });
  mocks.getOwner.mockReturnValue(ownerId);
  mocks.getSession.mockResolvedValue(sessionResult());
  mocks.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: mocks.unsubscribe } } });
  mocks.verify.mockResolvedValue(undefined);
});
afterEach(() => { expect(fetch).not.toHaveBeenCalled(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('Conexión sync desde la sesión Lia de main', () => {
  it('espera la verificación Auth antes de entregar conexión y libera su suscripción', async () => {
    const verification = deferred<void>();
    const accessToken = token();
    mocks.getSession.mockResolvedValue(sessionResult(accessToken));
    mocks.verify.mockReturnValue(verification.promise);
    const activeSignal = signal();
    const completed = vi.fn();
    const pending = createBrowserSyncConnection(activeSignal, guard).then((connection) => { completed(); return connection; });
    await vi.waitFor(() => expect(mocks.verify).toHaveBeenCalledWith(activeSignal));
    expect(completed).not.toHaveBeenCalled();
    expect(mocks.construct).toHaveBeenCalledWith({ origin, apiKey: 'clave-publica-ficticia', accessToken, ownerId, sessionId }, expect.any(Function));
    expect(mocks.unsubscribe).not.toHaveBeenCalled();
    verification.resolve(undefined);
    const connection = await pending;
    expect(connection.binding).toEqual({ origin, ownerId, sessionId });
    expect(completed).toHaveBeenCalledTimes(1);
    connection.dispose();
    expect(mocks.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['sesión ausente', { data: { session: null }, error: null }],
    ['error del proveedor', { data: { session: { access_token: token() } }, error: new Error('detalle interno ficticio') }],
  ] satisfies [string, SessionResult][])('rechaza %s sin suscribirse ni construir transporte', async (_label, result) => {
    mocks.getSession.mockResolvedValue(result);
    await expect(createBrowserSyncConnection(signal(), guard)).rejects.toThrow('iniciar sesión');
    expect(mocks.onAuthStateChange).not.toHaveBeenCalled(); expect(mocks.construct).not.toHaveBeenCalled();
  });

  it.each([{ is_anonymous: true }, { role: 'service_role' }, { session_id: 'inválido' }, { exp: 0 }])('rechaza claims no autorizados antes de Auth %#', async (extra) => {
    mocks.getSession.mockResolvedValue(sessionResult(token(extra)));
    await expect(createBrowserSyncConnection(signal(), guard)).rejects.toThrow('no anónima vigente');
    expect(mocks.onAuthStateChange).not.toHaveBeenCalled(); expect(mocks.verify).not.toHaveBeenCalled();
  });

  it('rechaza al titular distinto del contexto main, aunque su token tenga forma válida', async () => {
    mocks.getOwner.mockReturnValue(otherId);
    await expect(createBrowserSyncConnection(signal(), guard)).rejects.toThrow('no corresponde');
    expect(mocks.onAuthStateChange).not.toHaveBeenCalled(); expect(mocks.construct).not.toHaveBeenCalled();
  });

  it('libera el listener cuando Auth rechaza un token con claims válidos', async () => {
    const denied = new Error('Auth no verificó la sesión ficticia');
    mocks.verify.mockRejectedValue(denied);
    await expect(createBrowserSyncConnection(signal(), guard)).rejects.toBe(denied);
    expect(mocks.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('libera el listener si falla configurar el transporte', async () => {
    const invalid = new Error('Configuración inválida ficticia');
    mocks.construct.mockImplementationOnce(() => { throw invalid; });
    await expect(createBrowserSyncConnection(signal(), guard)).rejects.toBe(invalid);
    expect(mocks.verify).not.toHaveBeenCalled(); expect(mocks.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('conserva la sesión ante renovación del token sin cambiar titular ni session_id', async () => {
    const connection = await createBrowserSyncConnection(signal(), guard);
    listener()('TOKEN_REFRESHED', { access_token: token({ exp: Math.floor(Date.now() / 1000) + 600 }) });
    expect(sessionGuard()).not.toThrow();
    connection.dispose();
  });

  it.each([
    ['logout', null],
    ['otro session_id', { access_token: token({ session_id: otherId }) }],
    ['otro titular', { access_token: token({ sub: otherId }) }],
    ['sesión anónima', { access_token: token({ is_anonymous: true }) }],
    ['token malformado', { access_token: 'no-es-un-token' }],
  ] satisfies [string, AuthSession | null][])('invalida irreversiblemente la conexión ante %s', async (_label, next) => {
    const connection = await createBrowserSyncConnection(signal(), guard);
    listener()('SIGNED_OUT', next);
    expect(sessionGuard()).toThrow('cambió');
    listener()('SIGNED_IN', { access_token: token() });
    expect(sessionGuard()).toThrow('cambió');
    connection.dispose(); expect(mocks.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('rechaza verificación tardía tras cambiar de sesión y libera el listener', async () => {
    const verification = deferred<void>();
    mocks.verify.mockReturnValue(verification.promise);
    const pending = createBrowserSyncConnection(signal(), guard);
    const assertion = expect(pending).rejects.toThrow('cambió');
    await vi.waitFor(() => expect(mocks.verify).toHaveBeenCalled());
    listener()('SIGNED_IN', { access_token: token({ session_id: otherId }) });
    verification.resolve(undefined);
    await assertion; expect(mocks.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('vuelve a comprobar el contexto main antes de reutilizar el transporte', async () => {
    const connection = await createBrowserSyncConnection(signal(), guard);
    mocks.getOwner.mockReturnValue(otherId);
    expect(sessionGuard()).toThrow('cambió');
    connection.dispose();
  });

  it('rechaza una operación ya cancelada sin consultar la sesión', async () => {
    const controller = new AbortController(); controller.abort();
    await expect(createBrowserSyncConnection(controller.signal, guard)).rejects.toThrow('cancelada');
    expect(mocks.getClient).not.toHaveBeenCalled(); expect(mocks.getSession).not.toHaveBeenCalled();
  });

  it('cancela getSession pendiente y no usa su resultado tardío', async () => {
    const session = deferred<SessionResult>();
    mocks.getSession.mockReturnValue(session.promise);
    const controller = new AbortController();
    const pending = createBrowserSyncConnection(controller.signal, guard);
    const assertion = expect(pending).rejects.toThrow('cancelada');
    controller.abort(); await assertion;
    session.resolve(sessionResult()); await Promise.resolve(); await Promise.resolve();
    expect(mocks.onAuthStateChange).not.toHaveBeenCalled(); expect(mocks.verify).not.toHaveBeenCalled();
  });

  it('libera la suscripción al cancelar la verificación pendiente', async () => {
    const verification = deferred<void>();
    mocks.verify.mockImplementation((activeSignal) => abortableSync(verification.promise, activeSignal));
    const controller = new AbortController();
    const pending = createBrowserSyncConnection(controller.signal, guard);
    const assertion = expect(pending).rejects.toThrow('cancelada');
    await vi.waitFor(() => expect(mocks.verify).toHaveBeenCalled());
    controller.abort(); await assertion;
    expect(mocks.unsubscribe).toHaveBeenCalledTimes(1);
    verification.resolve(undefined); await Promise.resolve();
  });

  it('rechaza contexto sustituido mientras se leía la sesión', async () => {
    const session = deferred<SessionResult>();
    mocks.getSession.mockReturnValue(session.promise);
    let active = true;
    const pending = createBrowserSyncConnection(signal(), () => { if (!active) throw new Error('Contexto sustituido'); });
    const assertion = expect(pending).rejects.toThrow('sustituido');
    active = false; session.resolve(sessionResult()); await assertion;
    expect(mocks.onAuthStateChange).not.toHaveBeenCalled(); expect(mocks.construct).not.toHaveBeenCalled();
  });
});

describe('Caducidad de claims sync', () => {
  it.each([Number.MAX_SAFE_INTEGER + 1, Math.floor(Date.now() / 1000) + 300.5])('rechaza exp no entero seguro %#', (exp) => {
    expect(() => readBrowserSyncClaims(token({ exp }), origin)).toThrow('vigente');
  });
  it('rechaza el desbordamiento numérico de JSON aunque sea un número de JavaScript', () => {
    const raw = JSON.stringify({ ...claims(), exp: 'EXP_FICTICIO' }).replace('"EXP_FICTICIO"', '1e309');
    const overflow = `e30.${Buffer.from(raw).toString('base64url')}.firma-ficticia`;
    expect(() => readBrowserSyncClaims(overflow, origin)).toThrow('vigente');
  });
});
