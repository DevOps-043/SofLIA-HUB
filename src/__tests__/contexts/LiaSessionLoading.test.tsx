import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '@supabase/supabase-js';
import { useLiaSession } from '../../contexts/auth/useLiaSession';

const mocks = vi.hoisted(() => ({ getSession: vi.fn(), refreshSession: vi.fn(), exchange: vi.fn(), profile: vi.fn() }));
vi.mock('../../lib/supabase', () => ({ supabase: { auth: { getSession: mocks.getSession, refreshSession: mocks.refreshSession } } }));
vi.mock('../../services/lia-session-exchange', () => ({ exchangeSofiaForLiaSession: mocks.exchange }));
vi.mock('../../contexts/auth/lia-profile', () => ({ syncLiaProfile: mocks.profile }));
const session = { user: { id: 'lia-propio', email: 'prueba@example.test' } } as Session;
const deps = () => ({ setSession: vi.fn(), setLiaDegraded: vi.fn(), setLiaStatusMessage: vi.fn() });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.getSession.mockResolvedValue({ data: { session: null } });
  mocks.refreshSession.mockResolvedValue({ data: { session: null } });
  mocks.profile.mockResolvedValue(undefined);
  mocks.exchange.mockResolvedValue(session);
});

describe('Restauración rápida de conversaciones', () => {
  it('acepta una sesión persistida sin esperar el perfil y lo sincroniza una sola vez', async () => {
    mocks.getSession.mockResolvedValue({ data: { session } });
    mocks.profile.mockReturnValue(new Promise(() => {}));
    const state = deps();
    const { result } = renderHook(() => useLiaSession(state));
    await act(async () => expect(await result.current.ensureLiaSession(session.user.email)).toBe(session));
    expect(state.setLiaDegraded).toHaveBeenCalledWith(false);
    expect(mocks.profile).toHaveBeenCalledTimes(1);
    expect(mocks.exchange).not.toHaveBeenCalled();
  });

  it('un fallo de perfil no convierte una sesión válida en un error de chats', async () => {
    mocks.getSession.mockResolvedValue({ data: { session } });
    mocks.profile.mockRejectedValue(new Error('Perfil no disponible'));
    const state = deps();
    const { result } = renderHook(() => useLiaSession(state));
    await act(async () => expect(await result.current.ensureLiaSession(session.user.email)).toBe(session));
    expect(state.setLiaDegraded).not.toHaveBeenCalledWith(true);
  });

  it('restauración y login simultáneos comparten un canje y liberan el intento al terminar', async () => {
    let finish!: (value: Session) => void;
    mocks.exchange.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    const { result } = renderHook(() => useLiaSession(deps()));
    const first = result.current.ensureLiaSession(session.user.email, 'token-prueba');
    const second = result.current.ensureLiaSession(session.user.email, 'token-prueba');
    expect(first).toBe(second);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); finish(session); await first; });
    expect(mocks.exchange).toHaveBeenCalledTimes(1);
    await act(async () => { await result.current.ensureLiaSession(session.user.email, 'token-prueba'); });
    expect(mocks.exchange).toHaveBeenCalledTimes(2);
  });
});
