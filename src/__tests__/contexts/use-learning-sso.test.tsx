import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  completeSofiaSsoSession: vi.fn(),
  consumePending: vi.fn(async () => null),
  createRequest: vi.fn(),
  exchangeTicket: vi.fn(),
  isAvailable: vi.fn(() => true),
  openSso: vi.fn(async () => {}),
  subscribe: vi.fn(),
}));

vi.mock('../../services/learning-sso', async () => {
  const actual = await vi.importActual<typeof import('../../services/learning-sso')>(
    '../../services/learning-sso',
  );
  return {
    ...actual,
    consumePendingLearningSsoCallback: mocks.consumePending,
    createLearningSsoRequest: mocks.createRequest,
    exchangeTicketForSofiaSession: mocks.exchangeTicket,
    isLearningSsoAvailable: mocks.isAvailable,
    openLearningSso: mocks.openSso,
    subscribeToLearningSsoCallback: mocks.subscribe,
  };
});

vi.mock('../../services/sofia-auth', () => ({
  sofiaAuth: { completeSofiaSsoSession: mocks.completeSofiaSsoSession },
}));

import {
  SSO_DENIED_ERROR,
  SSO_GENERIC_ERROR,
  useLearningSso,
} from '../../contexts/auth/useLearningSso';

const REQUEST = {
  codeChallenge: 'c'.repeat(43),
  codeVerifier: 'v'.repeat(43),
  state: 's'.repeat(22),
};

/** Captura el escuchador registrado para simular el retorno del deep link. */
let emitCallback: ((payload: unknown) => void) | null = null;

function renderSsoHook() {
  const deps = {
    ensureLiaSession: vi.fn(async () => null),
    setSofiaContext: vi.fn(),
    setUser: vi.fn(),
    signOut: vi.fn(async () => {}),
  };
  const view = renderHook(() => useLearningSso(deps));
  return { deps, view };
}

describe('useLearningSso', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockClear());
    mocks.isAvailable.mockReturnValue(true);
    mocks.consumePending.mockResolvedValue(null);
    mocks.createRequest.mockResolvedValue(REQUEST);
    mocks.openSso.mockResolvedValue(undefined);
    emitCallback = null;
    mocks.subscribe.mockImplementation((handler: (payload: unknown) => void) => {
      emitCallback = handler;
      return () => { emitCallback = null; };
    });
  });

  it('abre el navegador y queda en espera', async () => {
    const { view } = renderSsoHook();

    await act(async () => { await view.result.current.signInWithLearningSso(); });

    expect(mocks.openSso).toHaveBeenCalledWith(REQUEST);
    expect(view.result.current.ssoPending).toBe(true);
    expect(view.result.current.ssoError).toBeNull();
  });

  it('descarta un retorno cuyo state no corresponde a la solicitud viva', async () => {
    const { view } = renderSsoHook();
    await act(async () => { await view.result.current.signInWithLearningSso(); });

    await act(async () => {
      emitCallback?.({ error: null, state: 'otro-state-cualquiera', ticket: 't'.repeat(64) });
    });

    // Ni canje, ni sesion, ni cambio de estado: el retorno ajeno no existe.
    expect(mocks.exchangeTicket).not.toHaveBeenCalled();
    expect(mocks.completeSofiaSsoSession).not.toHaveBeenCalled();
    expect(view.result.current.ssoPending).toBe(true);
    expect(view.result.current.ssoError).toBeNull();
  });

  it('ignora un retorno cuando no hay ninguna solicitud viva', async () => {
    renderSsoHook();

    await act(async () => {
      emitCallback?.({ error: null, state: REQUEST.state, ticket: 't'.repeat(64) });
    });

    expect(mocks.exchangeTicket).not.toHaveBeenCalled();
  });

  it('completa la sesion cuando el retorno correlaciona', async () => {
    const session = { access_token: 'token', user: { email: 'persona@soflia.ai' } };
    const authUser = { email: 'persona@soflia.ai', id: 'uuid-1' };
    mocks.exchangeTicket.mockResolvedValue(session);
    mocks.completeSofiaSsoSession.mockResolvedValue({
      session,
      sofiaProfile: { memberships: [{ status: 'active' }] },
      success: true,
      user: authUser,
    });

    const { deps, view } = renderSsoHook();
    await act(async () => { await view.result.current.signInWithLearningSso(); });

    await act(async () => {
      emitCallback?.({ error: null, state: REQUEST.state, ticket: 't'.repeat(64) });
    });

    await waitFor(() => expect(view.result.current.ssoPending).toBe(false));
    expect(mocks.exchangeTicket).toHaveBeenCalledWith('t'.repeat(64), REQUEST.codeVerifier);
    expect(deps.setUser).toHaveBeenCalledWith(authUser);
    expect(deps.ensureLiaSession).toHaveBeenCalledWith('persona@soflia.ai', 'token');
    expect(view.result.current.ssoError).toBeNull();
  });

  it('no consume dos veces el mismo retorno', async () => {
    mocks.exchangeTicket.mockResolvedValue({ user: { email: 'persona@soflia.ai' } });
    mocks.completeSofiaSsoSession.mockResolvedValue({
      session: null,
      sofiaProfile: { memberships: [{ status: 'active' }] },
      success: true,
      user: { email: 'persona@soflia.ai', id: 'uuid-1' },
    });

    const { view } = renderSsoHook();
    await act(async () => { await view.result.current.signInWithLearningSso(); });

    const payload = { error: null, state: REQUEST.state, ticket: 't'.repeat(64) };
    await act(async () => { emitCallback?.(payload); });
    await act(async () => { emitCallback?.(payload); });

    expect(mocks.exchangeTicket).toHaveBeenCalledTimes(1);
  });

  it('traduce un retorno de acceso denegado sin canjear', async () => {
    const { view } = renderSsoHook();
    await act(async () => { await view.result.current.signInWithLearningSso(); });

    await act(async () => {
      emitCallback?.({ error: 'access_denied', state: REQUEST.state, ticket: null });
    });

    await waitFor(() => expect(view.result.current.ssoError).toBe(SSO_DENIED_ERROR));
    expect(mocks.exchangeTicket).not.toHaveBeenCalled();
    expect(view.result.current.ssoPending).toBe(false);
  });

  it('cierra la sesion cuando el perfil no tiene membresia activa', async () => {
    mocks.exchangeTicket.mockResolvedValue({ user: { email: 'persona@soflia.ai' } });
    mocks.completeSofiaSsoSession.mockResolvedValue({
      session: null,
      sofiaProfile: null,
      success: true,
      user: { email: 'persona@soflia.ai', id: 'uuid-1' },
    });

    const { deps, view } = renderSsoHook();
    await act(async () => { await view.result.current.signInWithLearningSso(); });

    await act(async () => {
      emitCallback?.({ error: null, state: REQUEST.state, ticket: 't'.repeat(64) });
    });

    await waitFor(() => expect(deps.signOut).toHaveBeenCalled());
    expect(view.result.current.ssoError).toBe(SSO_DENIED_ERROR);
    expect(deps.setUser).not.toHaveBeenCalled();
  });

  it('muestra un mensaje no tecnico si el canje falla', async () => {
    mocks.exchangeTicket.mockRejectedValue(new Error('boom'));

    const { view } = renderSsoHook();
    await act(async () => { await view.result.current.signInWithLearningSso(); });

    await act(async () => {
      emitCallback?.({ error: null, state: REQUEST.state, ticket: 't'.repeat(64) });
    });

    await waitFor(() => expect(view.result.current.ssoError).toBe(SSO_GENERIC_ERROR));
    expect(view.result.current.ssoPending).toBe(false);
  });

  it('no se suscribe ni ofrece el flujo con el interruptor apagado', async () => {
    mocks.isAvailable.mockReturnValue(false);

    const { view } = renderSsoHook();

    expect(view.result.current.learningSsoAvailable).toBe(false);
    expect(mocks.subscribe).not.toHaveBeenCalled();

    await act(async () => { await view.result.current.signInWithLearningSso(); });
    expect(mocks.openSso).not.toHaveBeenCalled();
  });

  it('permite cancelar la espera', async () => {
    const { view } = renderSsoHook();
    await act(async () => { await view.result.current.signInWithLearningSso(); });

    act(() => { view.result.current.cancelLearningSso(); });

    expect(view.result.current.ssoPending).toBe(false);

    // Cancelada la solicitud, un retorno tardio ya no debe canjearse.
    await act(async () => {
      emitCallback?.({ error: null, state: REQUEST.state, ticket: 't'.repeat(64) });
    });
    expect(mocks.exchangeTicket).not.toHaveBeenCalled();
  });
});
