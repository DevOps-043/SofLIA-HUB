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
  listener: null as null | ((event: string, session: { refresh_token?: string } | null) => void),
}));

const client = vi.hoisted(() => ({ auth }));

vi.mock('../iris/clients', () => ({
  getSofiaClient: () => client,
  getSofiaCredentials: () => ({ url: 'https://sofia.supabase.co', key: 'anon' }),
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

function session(userId: string, refreshToken = 'refresh-nuevo') {
  return { user: { id: userId }, refresh_token: refreshToken };
}

describe('sesion SOFIA del proceso main', () => {
  beforeEach(() => {
    store.token = null;
    vi.clearAllMocks();
    resetSofiaSessionForTests();
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

    expect(resultado).toEqual({ status: 'aplicada', userId: 'user-1' });
    expect(getSofiaSessionUserId()).toBe('user-1');
    expect(store.save).toHaveBeenCalledWith('refresh-nuevo');
  });

  it('rechaza y revoca cuando el token pertenece a otro usuario', async () => {
    const resultado = await applySofiaSession(
      { accessToken: 'access', refreshToken: 'refresh' },
      'otro-user',
    );

    expect(resultado).toEqual({ status: 'rechazada', userId: null });
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
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
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });
});
