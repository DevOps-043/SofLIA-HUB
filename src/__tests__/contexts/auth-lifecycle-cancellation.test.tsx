import './auth-lifecycle.fixture';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '@supabase/supabase-js';
import { useAuthLifecycle } from '../../contexts/auth/useAuthLifecycle';
import { useLiaSession } from '../../contexts/auth/useLiaSession';
import { exchangeSofiaForLiaSession } from '../../services/lia-session-exchange';
import type { SofiaContextResolution } from '../../contexts/auth/types';
import { authMocks, deferred, emit, resetFixture, session } from './auth-lifecycle.fixture';

vi.mock('../../lib/supabase', async () => {
  const { authMocks: mocks } = await import('./auth-lifecycle.fixture');
  return { supabase: {
    auth: { getSession: mocks.liaRead, onAuthStateChange: mocks.liaSubscribe,
      refreshSession: mocks.refresh, signOut: mocks.signOut, verifyOtp: mocks.verifyOtp },
    functions: { invoke: mocks.invoke },
  } };
});
vi.mock('../../lib/sofia-client', () => ({ sofiaSupa: null }));
vi.mock('../../services/sofia-auth', async () => {
  const { authMocks: mocks } = await import('./auth-lifecycle.fixture');
  return { sofiaAuth: { getSession: mocks.sofiaRead, onAuthStateChange: mocks.sofiaSubscribe } };
});
vi.mock('../../contexts/auth/lia-profile', async () => {
  const { authMocks: mocks } = await import('./auth-lifecycle.fixture');
  return { syncLiaProfile: mocks.profile };
});

let deps: ReturnType<typeof resetFixture>;
beforeEach(() => { deps = resetFixture(); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });
async function flush() { await act(async () => { await Promise.resolve(); }); }
function mountIntegrated() {
  return renderHook(() => {
    const lia = useLiaSession(deps);
    useAuthLifecycle({ ...deps, ensureLiaSession: lia.ensureLiaSession });
  });
}

describe('Vigencia de restauración y eventos Auth', () => {
  it('suscribe antes de leer y el callback no devuelve una promesa', async () => {
    authMocks.sofiaRead.mockImplementation(() => {
      expect(authMocks.sofiaSubscribe).toHaveBeenCalledOnce();
      return Promise.resolve(null);
    });
    renderHook(() => useAuthLifecycle(deps));
    await flush();
    expect(emit('SIGNED_IN', session())).toBeUndefined();
    await flush();
  });

  it.each([true, false])('descarta restauración inicial tras cierre, SOFIA=%s', async usingSofia => {
    deps.usingSofia = usingSofia;
    const initial = deferred<Session | null>();
    if (usingSofia) authMocks.sofiaRead.mockReturnValue(initial.promise);
    else authMocks.liaRead.mockImplementation(async () => ({ data: { session: await initial.promise } }));
    renderHook(() => useAuthLifecycle(deps));
    await flush();
    act(() => { emit('SIGNED_OUT', null, usingSofia); });
    vi.clearAllMocks();
    initial.resolve(session());
    await flush();
    expect(deps.setUser).not.toHaveBeenCalled();
    expect(deps.setSession).not.toHaveBeenCalled();
    expect(deps.setLoading).not.toHaveBeenCalled();
    expect(deps.ensureLiaSession).not.toHaveBeenCalled();
  });

  it('un error inicial anterior no borra la sesión nueva ni registra el error libre', async () => {
    const initial = deferred<Session | null>();
    authMocks.sofiaRead.mockReturnValue(initial.promise);
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    renderHook(() => useAuthLifecycle(deps));
    await flush();
    act(() => { emit('SIGNED_IN', session('b')); });
    await flush();
    vi.clearAllMocks();
    initial.reject(new Error('detalle-privado-ficticio'));
    await flush();
    expect(deps.clearSessionState).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
    expect(deps.setLoading).not.toHaveBeenCalled();
  });

  it.each(['denied', 'error'] as const)('descarta resolución %s de una identidad anterior', async status => {
    const old = deferred<SofiaContextResolution>();
    deps.resolveSofiaContext.mockReturnValueOnce(old.promise);
    renderHook(() => useAuthLifecycle(deps));
    await flush();
    act(() => { emit('SIGNED_IN', session()); });
    await flush();
    act(() => { emit('SIGNED_OUT', null); });
    vi.clearAllMocks();
    old.resolve(status === 'denied' ? { status } : { status, error: new Error('viejo') });
    await flush();
    expect(deps.signOut).not.toHaveBeenCalled();
    expect(deps.setUser).not.toHaveBeenCalled();
    expect(deps.setSofiaContextIssue).not.toHaveBeenCalled();
    expect(deps.ensureLiaSession).not.toHaveBeenCalled();
    expect(deps.setLoading).not.toHaveBeenCalled();
  });

  it('A/B/A no rehabilita una resolución antigua', async () => {
    const old = deferred<SofiaContextResolution>();
    deps.resolveSofiaContext.mockReturnValueOnce(old.promise);
    renderHook(() => useAuthLifecycle(deps));
    await flush();
    act(() => { emit('SIGNED_IN', session()); });
    await flush();
    act(() => { emit('SIGNED_IN', session('b')); emit('SIGNED_IN', session()); });
    await flush();
    vi.clearAllMocks();
    old.resolve({ status: 'denied' });
    await flush();
    expect(deps.signOut).not.toHaveBeenCalled();
    expect(deps.setLoading).not.toHaveBeenCalled();
  });

  it('INITIAL_SESSION tardío no revierte un cierre', async () => {
    renderHook(() => useAuthLifecycle(deps));
    await flush();
    act(() => { emit('SIGNED_OUT', null); });
    const callback = authMocks.sofiaSubscribe.mock.lastCall?.[0] as (event: string, value: Session | null) => unknown;
    vi.clearAllMocks();
    act(() => { callback('INITIAL_SESSION', session()); });
    await flush();
    expect(deps.setUser).not.toHaveBeenCalled();
    expect(deps.ensureLiaSession).not.toHaveBeenCalled();
  });

  it('desmontar libera la suscripción y descarta la lectura pendiente', async () => {
    const initial = deferred<Session | null>();
    authMocks.sofiaRead.mockReturnValue(initial.promise);
    const { unmount } = renderHook(() => useAuthLifecycle(deps));
    await flush();
    unmount();
    expect(deps.subscription.unsubscribe).toHaveBeenCalledOnce();
    vi.clearAllMocks();
    initial.resolve(session());
    await flush();
    expect(deps.setUser).not.toHaveBeenCalled();
    expect(deps.setLoading).not.toHaveBeenCalled();
    expect(deps.ensureLiaSession).not.toHaveBeenCalled();
  });

  it('al cambiar de sujeto limpia datos anteriores antes de resolver el nuevo', async () => {
    renderHook(() => useAuthLifecycle(deps));
    await flush();
    act(() => { emit('SIGNED_IN', session()); });
    await flush();
    deps.resolveSofiaContext.mockReturnValue(deferred<SofiaContextResolution>().promise);
    const callback = authMocks.sofiaSubscribe.mock.lastCall?.[0] as (event: string, value: Session | null) => unknown;
    vi.clearAllMocks();
    act(() => { callback('SIGNED_IN', session('b')); });
    expect(deps.clearSessionState).toHaveBeenCalledOnce();
    expect(deps.setLoading).toHaveBeenCalledWith(true);
    await flush();
    expect(deps.setUser).not.toHaveBeenCalled();
  });
});

describe('Cancelación de recuperación Lia integrada al lifecycle', () => {
  it.each(['lectura', 'refresh'] as const)('cancela tras %s sin publicar ni iniciar canje', async step => {
    authMocks.sofiaRead.mockResolvedValue(session());
    const response = deferred<{ data: { session: Session | null } }>();
    (step === 'lectura' ? authMocks.liaRead : authMocks.refresh).mockReturnValue(response.promise);
    mountIntegrated();
    await waitFor(() => expect(step === 'lectura' ? authMocks.liaRead : authMocks.refresh).toHaveBeenCalled());
    act(() => { emit('SIGNED_OUT', null); });
    vi.clearAllMocks();
    response.resolve({ data: { session: step === 'lectura' ? null : session() } });
    await flush();
    expect(deps.setSession).not.toHaveBeenCalled();
    expect(deps.setLiaDegraded).not.toHaveBeenCalled();
    expect(authMocks.profile).not.toHaveBeenCalled();
    expect(authMocks.invoke).not.toHaveBeenCalled();
    if (step === 'lectura') expect(authMocks.refresh).not.toHaveBeenCalled();
  });

  it('cancela tras canje sin enviar OTP', async () => {
    authMocks.sofiaRead.mockResolvedValue(session());
    const response = deferred<{ data: { tokenHash: string }; error: null }>();
    authMocks.invoke.mockReturnValue(response.promise);
    mountIntegrated();
    await waitFor(() => expect(authMocks.invoke).toHaveBeenCalledOnce());
    act(() => { emit('SIGNED_OUT', null); });
    vi.clearAllMocks();
    response.resolve({ data: { tokenHash: 'hash-tardio' }, error: null });
    await flush();
    expect(authMocks.verifyOtp).not.toHaveBeenCalled();
    expect(deps.setSession).not.toHaveBeenCalled();
    expect(deps.setLiaDegraded).not.toHaveBeenCalled();
  });

  it.each(['a', 'otro'])('cancela tras OTP para %s sin publicar ni cerrar otra sesión', async id => {
    authMocks.sofiaRead.mockResolvedValue(session());
    const response = deferred<{ data: { session: Session }; error: null }>();
    authMocks.verifyOtp.mockReturnValue(response.promise);
    mountIntegrated();
    await waitFor(() => expect(authMocks.verifyOtp).toHaveBeenCalledOnce());
    act(() => { emit('SIGNED_OUT', null); });
    vi.clearAllMocks();
    response.resolve({ data: { session: session(id) }, error: null });
    await flush();
    expect(authMocks.signOut).not.toHaveBeenCalled();
    expect(authMocks.profile).not.toHaveBeenCalled();
    expect(deps.setSession).not.toHaveBeenCalled();
    expect(deps.setLiaDegraded).not.toHaveBeenCalled();
  });
});

describe('Errores y recursos del ciclo Auth', () => {
  it('un evento inicial síncrono evita una lectura redundante', async () => {
    authMocks.sofiaSubscribe.mockImplementation(callback => {
      callback('INITIAL_SESSION', session());
      return { data: { subscription: deps.subscription } };
    });
    renderHook(() => useAuthLifecycle(deps));
    await flush();
    expect(authMocks.sofiaRead).not.toHaveBeenCalled();
    expect(deps.ensureLiaSession).toHaveBeenCalledOnce();
  });

  it('un refresh vigente conserva identidad y recupera Lia sin vaciar datos', async () => {
    authMocks.sofiaRead.mockResolvedValue(session());
    renderHook(() => useAuthLifecycle(deps));
    await flush();
    deps.clearSessionState.mockClear();
    act(() => { emit('TOKEN_REFRESHED', session()); });
    await flush();
    expect(deps.clearSessionState).not.toHaveBeenCalled();
    expect(deps.ensureLiaSession).toHaveBeenCalledTimes(2);
    expect(deps.setLoading).toHaveBeenLastCalledWith(false);
  });

  it('un fallo de suscripción bloquea incluso un callback retenido y no filtra detalles', async () => {
    let retained!: (event: string, value: Session | null) => unknown;
    authMocks.sofiaSubscribe.mockImplementation(callback => {
      retained = callback;
      throw new Error('detalle-privado-ficticio');
    });
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    renderHook(() => useAuthLifecycle(deps));
    act(() => { retained('SIGNED_IN', session()); });
    await flush();
    expect(deps.setUser).not.toHaveBeenCalled();
    expect(deps.ensureLiaSession).not.toHaveBeenCalled();
    expect(deps.clearSessionState).toHaveBeenCalledOnce();
    expect(log).toHaveBeenCalledExactlyOnceWith('[autenticacion] no se pudo suscribir a la sesion');
  });

  it('un fallo vigente al resolver se maneja sin rechazo libre', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    deps.resolveSofiaContext.mockRejectedValue(new Error('detalle-privado-ficticio'));
    authMocks.sofiaRead.mockResolvedValue(session());
    renderHook(() => useAuthLifecycle(deps));
    await flush();
    expect(log).toHaveBeenCalledExactlyOnceWith('[autenticacion] no se pudo restaurar la sesion');
    expect(deps.setLoading).toHaveBeenLastCalledWith(false);
    expect(deps.ensureLiaSession).not.toHaveBeenCalled();
  });

  it('unsubscribe conserva su receptor y no rehabilita la operación si falla', async () => {
    const pending = deferred<SofiaContextResolution>();
    deps.resolveSofiaContext.mockReturnValue(pending.promise);
    authMocks.sofiaRead.mockResolvedValue(session());
    const subscription = { unsubscribe: vi.fn(function (this: unknown) {
      expect(this).toBe(subscription);
      throw new Error('detalle-privado-ficticio');
    }) };
    authMocks.sofiaSubscribe.mockReturnValue({ data: { subscription } });
    const log = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { unmount } = renderHook(() => useAuthLifecycle(deps));
    await flush();
    unmount();
    pending.resolve({ status: 'denied' });
    await flush();
    expect(subscription.unsubscribe).toHaveBeenCalledOnce();
    expect(log).toHaveBeenCalledExactlyOnceWith('[autenticacion] no se pudo liberar la suscripcion');
    expect(deps.signOut).not.toHaveBeenCalled();
  });

  it('StrictMode descarta la primera restauración y conserva la segunda', async () => {
    const first = deferred<Session | null>();
    authMocks.sofiaRead.mockReturnValueOnce(first.promise).mockResolvedValue(session('b'));
    renderHook(() => useAuthLifecycle(deps), { reactStrictMode: true });
    await flush();
    expect(authMocks.sofiaRead).toHaveBeenCalledTimes(2);
    expect(authMocks.sofiaSubscribe).toHaveBeenCalledTimes(2);
    deps.setUser.mockClear();
    first.resolve(session());
    await flush();
    expect(deps.setUser).not.toHaveBeenCalled();
    expect(deps.ensureLiaSession).toHaveBeenCalledExactlyOnceWith(
      'b@example.invalid', 'token-ficticio-b', expect.any(AbortSignal),
    );
    expect(deps.subscription.unsubscribe).toHaveBeenCalledOnce();
  });

  it('restaurar Lia sincroniza perfil una vez y un rechazo auxiliar no borra la sesión', async () => {
    authMocks.liaRead.mockResolvedValue({ data: { session: session() } });
    authMocks.profile.mockRejectedValue(new Error('detalle-privado-ficticio'));
    const log = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { result } = renderHook(() => useLiaSession(deps));
    await act(async () => {
      expect(await result.current.ensureLiaSession('a@example.invalid')).toEqual(session());
    });
    expect(authMocks.profile).toHaveBeenCalledOnce();
    expect(deps.setSession).toHaveBeenCalledExactlyOnceWith(session());
    expect(deps.setLiaDegraded).toHaveBeenCalledExactlyOnceWith(false);
    expect(log).toHaveBeenCalledExactlyOnceWith('[sesion-conversaciones] no se pudo sincronizar el perfil');
  });

  it('una recuperación ya cancelada no lee SDK ni degrada datos', async () => {
    const controller = new AbortController();
    controller.abort();
    const { result } = renderHook(() => useLiaSession(deps));
    await act(async () => {
      expect(await result.current.ensureLiaSession(null, null, controller.signal)).toBeNull();
    });
    expect(authMocks.liaRead).not.toHaveBeenCalled();
    expect(deps.setSession).not.toHaveBeenCalled();
    expect(deps.setLiaDegraded).not.toHaveBeenCalled();
  });
});

describe('Cancelación y reintentos del canje Lia', () => {
  it('una señal cancelada impide comenzar el canje', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(exchangeSofiaForLiaSession('a@example.invalid', 'token-ficticio', controller.signal))
      .rejects.toMatchObject({ name: 'AbortError' });
    expect(authMocks.invoke).not.toHaveBeenCalled();
  });

  it('cancelar backoff libera timer/listener y no reintenta', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const remove = vi.spyOn(controller.signal, 'removeEventListener');
    authMocks.invoke.mockResolvedValue({ data: null, error: { status: 503 } });
    const outcome = exchangeSofiaForLiaSession('a@example.invalid', 'token-ficticio', controller.signal)
      .catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(0);
    expect(vi.getTimerCount()).toBe(1);
    controller.abort();
    expect(await outcome).toMatchObject({ name: 'AbortError' });
    await vi.advanceTimersByTimeAsync(1000);
    expect(authMocks.invoke).toHaveBeenCalledOnce();
    expect(authMocks.verifyOtp).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    expect(remove).toHaveBeenCalledOnce();
  });

  it('un reintento vigente recupera sesión y libera su listener', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const remove = vi.spyOn(controller.signal, 'removeEventListener');
    authMocks.invoke.mockResolvedValueOnce({ data: null, error: { status: 503 } });
    const outcome = exchangeSofiaForLiaSession('a@example.invalid', 'token-ficticio', controller.signal);
    await vi.advanceTimersByTimeAsync(250);
    expect(await outcome).toEqual(session());
    expect(authMocks.invoke).toHaveBeenCalledTimes(2);
    expect(authMocks.verifyOtp).toHaveBeenCalledOnce();
    expect(remove).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('un fallo permanente vigente conserva la denegación sin reintentos', async () => {
    authMocks.invoke.mockResolvedValue({ data: null, error: { status: 403 } });
    await expect(exchangeSofiaForLiaSession('a@example.invalid', 'token-ficticio'))
      .rejects.toMatchObject({ code: 'access_denied', retryable: false });
    expect(authMocks.invoke).toHaveBeenCalledOnce();
    expect(authMocks.verifyOtp).not.toHaveBeenCalled();
  });
});
