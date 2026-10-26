import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '@supabase/supabase-js';
import { useAuthLifecycle } from '../../contexts/auth/useAuthLifecycle';

const mocks = vi.hoisted(() => ({ getSession: vi.fn(), subscribe: vi.fn(), unsubscribe: vi.fn() }));
vi.mock('../../services/sofia-auth', () => ({ sofiaAuth: { getSession: mocks.getSession, onAuthStateChange: mocks.subscribe } }));
vi.mock('../../lib/supabase', () => ({ supabase: {} }));
vi.mock('../../contexts/auth/lia-profile', () => ({ syncLiaProfile: vi.fn() }));
const session = { user: { id: 'sofia-propio', email: 'prueba@example.test' }, access_token: 'token-prueba' } as Session;
function setup() {
  const deps = {
    usingSofia: true, clearSessionState: vi.fn(), ensureLiaSession: vi.fn().mockResolvedValue(null),
    resolveSofiaContext: vi.fn().mockResolvedValue({ status: 'error' }), signOut: vi.fn(),
    setLoading: vi.fn(), setSofiaContextIssue: vi.fn(), setSession: vi.fn(), setSofiaContext: vi.fn(), setUser: vi.fn(),
  };
  const view = renderHook(() => useAuthLifecycle(deps));
  const callback = mocks.subscribe.mock.calls[0][0] as (event: string, value: Session | null) => unknown;
  return { ...view, deps, callback };
}
beforeEach(() => {
  vi.useFakeTimers(); vi.resetAllMocks();
  mocks.getSession.mockResolvedValue(null);
  mocks.subscribe.mockReturnValue({ data: { subscription: { unsubscribe: mocks.unsubscribe } } });
});
afterEach(() => vi.useRealTimers());

describe('Eventos de autenticación sin retener el SDK', () => {
  it('el callback retorna antes de consultar perfil y realizar el canje', async () => {
    const { callback, deps } = setup();
    await act(async () => { await Promise.resolve(); });
    expect(callback('SIGNED_IN', session)).toBeUndefined();
    expect(deps.resolveSofiaContext).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(deps.resolveSofiaContext).toHaveBeenCalledWith('sofia-propio');
    expect(deps.ensureLiaSession).toHaveBeenCalledWith('prueba@example.test', 'token-prueba');
  });

  it('INITIAL_SESSION no duplica la restauración explícita de getSession', async () => {
    mocks.getSession.mockResolvedValue(session);
    const { callback, deps } = setup();
    callback('INITIAL_SESSION', session);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(deps.resolveSofiaContext).toHaveBeenCalledTimes(1);
    expect(deps.ensureLiaSession).toHaveBeenCalledTimes(1);
  });

  it('logout cancela un login programado y desmontar libera los timers', async () => {
    const { callback, deps, unmount } = setup();
    await act(async () => { await Promise.resolve(); });
    callback('SIGNED_IN', session);
    callback('SIGNED_OUT', null);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(deps.resolveSofiaContext).not.toHaveBeenCalled();
    callback('TOKEN_REFRESHED', session);
    unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(deps.resolveSofiaContext).not.toHaveBeenCalled();
    expect(mocks.unsubscribe).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});
