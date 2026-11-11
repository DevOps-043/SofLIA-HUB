import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = vi.hoisted(() => ({
  token: null as string | null,
  save: vi.fn((token: string) => { store.token = token; return true; }),
  clear: vi.fn(() => { store.token = null; }),
}));

const auth = vi.hoisted(() => ({
  setSession: vi.fn(),
  refreshSession: vi.fn(),
  signOut: vi.fn(async () => ({ error: null })),
  onAuthStateChange: vi.fn(),
  listener: null as null | ((event: string, session: { user: { id: string }; refresh_token?: string } | null) => void),
}));

const client = vi.hoisted(() => ({ auth }));
const discard = vi.hoisted(() => vi.fn(async () => undefined));
const discardHub = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock('../iris/clients', () => ({
  getSofiaClient: () => client,
  getSofiaCredentials: () => ({ url: 'https://sofia.supabase.co', key: 'anon' }),
  discardSofiaClient: discard,
}));

vi.mock('../hub-db-client', () => ({ getHubDbClient: () => client, discardHubDbClient: discardHub }));
vi.mock('../main/hub-session-store', () => ({
  saveHubRefreshToken: store.save,
  readHubRefreshToken: () => store.token,
  clearHubRefreshToken: store.clear,
  hasStoredHubSession: () => store.token !== null,
}));
vi.mock('../main/sofia-session-store', () => ({
  saveSofiaRefreshToken: store.save,
  readSofiaRefreshToken: () => store.token,
  clearSofiaRefreshToken: store.clear,
  hasStoredSofiaSession: () => store.token !== null,
}));

import {
  applySofiaSession,
  getSofiaSessionUserId,
  resetSofiaSessionForTests,
  restoreSofiaSession,
  revokeSofiaSession,
} from '../main/sofia-session';
import { applyHubSession, getHubSessionUserId, resetHubSessionForTests, revokeHubSession } from '../main/hub-session';

function session(userId: string, refreshToken = 'refresh-nuevo') {
  return { user: { id: userId }, refresh_token: refreshToken, access_token: 'acceso-verificado' };
}

describe('sesion SOFIA del proceso main', () => {
  beforeEach(() => {
    store.token = null;
    vi.clearAllMocks();
    resetSofiaSessionForTests();
    resetHubSessionForTests();
    auth.onAuthStateChange.mockImplementation((listener) => {
      auth.listener = listener;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });
    auth.setSession.mockResolvedValue({ data: { session: session('user-1') }, error: null });
    auth.refreshSession.mockResolvedValue({ data: { session: session('user-1') }, error: null });
  });

  it('aplica y persiste la sesion cuya identidad coincide', async () => {
    const resultado = await applySofiaSession(
      { accessToken: 'access', refreshToken: 'refresh' },
      'user-1',
    );

    expect(resultado).toEqual({ status: 'aplicada', userId: 'user-1', accessToken: 'acceso-verificado' });
    expect(getSofiaSessionUserId()).toBe('user-1');
    expect(store.save).toHaveBeenCalledWith('refresh-nuevo');
  });

  it('rechaza y revoca cuando el token pertenece a otro usuario', async () => {
    const resultado = await applySofiaSession(
      { accessToken: 'access', refreshToken: 'refresh' },
      'otro-user',
    );

    expect(resultado).toEqual({ status: 'rechazada', userId: null });
    expect(discard).toHaveBeenCalledOnce();
    expect(auth.signOut).not.toHaveBeenCalled();
    expect(store.clear).toHaveBeenCalled();
  });

  it('no aplica ni persiste una sesion sin identidad esperada', async () => {
    const resultado = await applySofiaSession(
      { accessToken: 'access', refreshToken: 'refresh' },
      '',
    );

    expect(resultado).toEqual({ status: 'sin-sesion', userId: null });
    expect(auth.setSession).not.toHaveBeenCalled();
    expect(store.save).not.toHaveBeenCalled();
  });

  it('identifica la sesión revocada por Supabase sin devolver credenciales', async () => {
    auth.setSession.mockResolvedValueOnce({
      data: { session: null }, error: { name: 'AuthSessionMissingError', status: 400 },
    });
    const result = await applySofiaSession({ accessToken: 'acceso', refreshToken: 'renovación' }, 'user-1');
    expect(result).toEqual({ status: 'rechazada', userId: null, revoked: true });
  });

  it('restaura desde el refresh token antes de los servicios', async () => {
    store.token = 'refresh-guardado';

    const resultado = await restoreSofiaSession();

    expect(auth.refreshSession).toHaveBeenCalledWith({ refresh_token: 'refresh-guardado' });
    expect(resultado).toEqual({ status: 'aplicada', userId: 'user-1' });
  });

  it('descarta un refresh token rechazado', async () => {
    store.token = 'refresh-invalido';
    auth.refreshSession.mockResolvedValueOnce({ data: { session: null }, error: { message: 'invalid' } });

    const resultado = await restoreSofiaSession();

    expect(resultado).toEqual({ status: 'rechazada', userId: null });
    expect(store.clear).toHaveBeenCalled();
  });

  it('persiste la rotacion de refresh token sin exponerlo', async () => {
    await applySofiaSession({ accessToken: 'access', refreshToken: 'refresh' }, 'user-1');

    auth.listener?.('TOKEN_REFRESHED', session('user-1', 'refresh-rotado'));

    expect(store.save).toHaveBeenLastCalledWith('refresh-rotado');
  });

  it('revocar borra disco, memoria y sesion local', async () => {
    await applySofiaSession({ accessToken: 'access', refreshToken: 'refresh' }, 'user-1');

    await revokeSofiaSession();

    expect(getSofiaSessionUserId()).toBeNull();
    expect(store.clear).toHaveBeenCalled();
    expect(discard).toHaveBeenCalledOnce();
    expect(auth.signOut).not.toHaveBeenCalled();
  });

  it('descarta la copia Lia sin revocar la sesión compartida ni aceptar una aplicación tardía', async () => {
    let finish!: (value: { data: { session: ReturnType<typeof session> }; error: null }) => void;
    auth.setSession.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const applying = applyHubSession({ accessToken: 'acceso-ficticio', refreshToken: 'refresh-ficticio' }, 'user-1');
    await revokeHubSession();
    finish({ data: { session: session('user-1') }, error: null });
    expect(await applying).toBe('sin-sesion');
    expect(getHubSessionUserId()).toBeNull();
    expect(discardHub).toHaveBeenCalledOnce();
    expect(store.save).not.toHaveBeenCalled();
    expect(auth.signOut).not.toHaveBeenCalled();
  });
});
