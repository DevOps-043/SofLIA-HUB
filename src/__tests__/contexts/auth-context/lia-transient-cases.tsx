import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  createSofiaSignInPayload,
  createWrapper,
  resetAuthMocks,
  sofiaMocks,
  supabaseMocks,
  useAuth,
} from './setup';

describe('AuthContext intercambio automatico de conversaciones', () => {
  beforeEach(resetAuthMocks);

  it('AUTH-024: dos contraseñas incorrectas previas no se propagan al servicio operativo', async () => {
    sofiaMocks.signInWithSofia
      .mockResolvedValueOnce({ success: false, user: null, session: null, error: 'Credenciales invalidas' })
      .mockResolvedValueOnce({ success: false, user: null, session: null, error: 'Credenciales invalidas' })
      .mockResolvedValueOnce(createSofiaSignInPayload());

    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });
    await act(async () => {
      await result.current.signInWithSofia('test@soflia.com', 'incorrecta-1');
      await result.current.signInWithSofia('test@soflia.com', 'incorrecta-2');
      await result.current.signInWithSofia('test@soflia.com', 'correcta');
    });

    expect(supabaseMocks.invoke).toHaveBeenCalledTimes(1);
    expect(supabaseMocks.invoke).toHaveBeenCalledWith('sofia-session-exchange', {
      body: {},
      headers: { Authorization: 'Bearer token' },
    });
    expect(supabaseMocks.signInWithPassword).not.toHaveBeenCalled();
    expect(supabaseMocks.signUp).not.toHaveBeenCalled();
    expect(result.current.dataUserId).toBe('lia-user-1');
  });

  it('AUTH-025: una denegacion secundaria conserva SOFIA y muestra un estado no tecnico', async () => {
    sofiaMocks.signInWithSofia.mockResolvedValue(createSofiaSignInPayload());
    supabaseMocks.invoke.mockResolvedValueOnce({
      data: null,
      error: { context: { status: 403 } },
    });

    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });
    await act(async () => {
      await result.current.signInWithSofia('test@soflia.com', 'correcta');
    });

    expect(result.current.user?.id).toBe('sofia-user-1');
    expect(result.current.dataUserId).toBeNull();
    expect(result.current.liaDegraded).toBe(true);
    expect(result.current.liaStatusMessage).toBe('No pudimos cargar tus conversaciones. Intenta nuevamente.');
    expect(sofiaMocks.signOut).not.toHaveBeenCalled();
  });

  it('AUTH-026: reintentar recupera conversaciones sin pedir otra contraseña', async () => {
    sofiaMocks.signInWithSofia.mockResolvedValue(createSofiaSignInPayload());
    supabaseMocks.invoke
      .mockResolvedValueOnce({ data: null, error: { context: { status: 403 } } })
      .mockResolvedValueOnce({ data: { tokenHash: 'token-reintento' }, error: null });

    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });
    await act(async () => {
      await result.current.signInWithSofia('test@soflia.com', 'correcta');
    });
    expect(result.current.liaDegraded).toBe(true);

    let recovered = false;
    await act(async () => {
      recovered = await result.current.retryConversations();
    });

    expect(recovered).toBe(true);
    expect(result.current.dataUserId).toBe('lia-user-1');
    expect(result.current.liaDegraded).toBe(false);
    expect(supabaseMocks.signInWithPassword).not.toHaveBeenCalled();
  });

  it('AUTH-027: una sesion operativa de otro correo se cierra localmente antes del intercambio', async () => {
    sofiaMocks.signInWithSofia.mockResolvedValue(createSofiaSignInPayload());
    supabaseMocks.getSession.mockResolvedValueOnce({
      data: { session: { user: { id: 'lia-ajeno', email: 'otra@soflia.com' } } },
      error: null,
    });

    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });
    await act(async () => {
      await result.current.signInWithSofia('test@soflia.com', 'correcta');
    });

    expect(supabaseMocks.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(supabaseMocks.invoke).toHaveBeenCalledTimes(1);
    expect(result.current.dataUserId).toBe('lia-user-1');
  });

  it('AUTH-028: la restauracion persistida intercambia automaticamente con el token SOFIA', async () => {
    sofiaMocks.getSession.mockResolvedValue({
      user: { id: 'sofia-user-1', email: 'test@soflia.com', user_metadata: {} },
    });
    sofiaMocks.fetchSofiaUserProfile.mockResolvedValue({
      id: 'sofia-user-1',
      email: 'test@soflia.com',
      memberships: [{ status: 'active', organization_id: 'org-1' }],
      organizations: [{ id: 'org-1', name: 'Org' }],
      teams: [],
    });

    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.dataUserId).toBe('lia-user-1'), { timeout: 5000 });

    expect(supabaseMocks.getSofiaSession).toHaveBeenCalled();
    expect(supabaseMocks.invoke).toHaveBeenCalledWith('sofia-session-exchange', {
      body: {},
      headers: { Authorization: 'Bearer token-restaurado' },
    });
  });

  it('AUTH-035: un fallo 5xx se reintenta de forma acotada y recupera la sesion', async () => {
    sofiaMocks.signInWithSofia.mockResolvedValue(createSofiaSignInPayload());
    supabaseMocks.invoke
      .mockResolvedValueOnce({ data: null, error: { context: { status: 503 } } })
      .mockResolvedValueOnce({ data: { tokenHash: 'token-recuperado' }, error: null });

    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });
    await act(async () => {
      await result.current.signInWithSofia('test@soflia.com', 'correcta');
    });

    expect(supabaseMocks.invoke).toHaveBeenCalledTimes(2);
    expect(result.current.dataUserId).toBe('lia-user-1');
    expect(result.current.liaDegraded).toBe(false);
  });

  it('AUTH-036: el canje para otro correo se revoca localmente y nunca habilita datos ajenos', async () => {
    sofiaMocks.signInWithSofia.mockResolvedValue(createSofiaSignInPayload());
    supabaseMocks.verifyOtp.mockResolvedValueOnce({
      data: { session: { user: { id: 'lia-ajeno', email: 'otra@soflia.com' } }, user: null },
      error: null,
    });

    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });
    await act(async () => {
      await result.current.signInWithSofia('test@soflia.com', 'correcta');
    });

    expect(supabaseMocks.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(result.current.dataUserId).toBeNull();
    expect(result.current.liaDegraded).toBe(true);
  });
});
