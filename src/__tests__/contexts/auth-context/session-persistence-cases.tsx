import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { createWrapper, resetAuthMocks, sofiaMocks, useAuth } from './setup';

// Sesion persistida que la app intenta restaurar al arrancar (p. ej. tras
// reiniciar la computadora).
function createStoredSofiaSession(accessToken: string | null = 'sofia-token') {
  return {
    // Sin `access_token` la sesion viene del snapshot local y SOFIA no puede
    // verificarla: ese caso no es una caida transitoria sino una caducidad.
    ...(accessToken ? { access_token: accessToken } : {}),
    user: {
      id: 'sofia-user-1',
      email: 'test@soflia.com',
      user_metadata: { first_name: 'Test' },
    },
  };
}

function createProfileConMembresia() {
  return {
    id: 'sofia-user-1',
    email: 'test@soflia.com',
    memberships: [{ status: 'active', organization_id: 'org-1', team_id: 'team-1' }],
    organizations: [{ id: 'org-1', name: 'TestOrg' }],
    teams: [{ id: 'team-1', name: 'TestTeam', organization_id: 'org-1' }],
  };
}

describe('AuthContext persistencia de sesion', () => {
  beforeEach(resetAuthMocks);

  it('AUTH-010: un fallo transitorio de SOFIA conserva la sesion y degrada solo el directorio', async () => {
    sofiaMocks.getSession.mockResolvedValue(createStoredSofiaSession());
    // SOFIA no disponible: el perfil vuelve null en todos los reintentos.
    sofiaMocks.fetchSofiaUserProfile.mockResolvedValue(null);

    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.user?.id).toBe('sofia-user-1');
    }, { timeout: 5000 });

    expect(sofiaMocks.signOut).not.toHaveBeenCalled();
    expect(result.current.sofiaContextDegraded).toBe(true);
    expect(result.current.sofiaStatusMessage).toContain('Tu sesion sigue activa');
    // Se reintenta antes de degradar.
    expect(sofiaMocks.fetchSofiaUserProfile.mock.calls.length).toBeGreaterThan(1);
  });

  it('AUTH-013: el directorio caido no se lleva por delante las conversaciones', async () => {
    sofiaMocks.getSession.mockResolvedValue(createStoredSofiaSession());
    sofiaMocks.fetchSofiaUserProfile.mockResolvedValue(null);

    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.sofiaContextDegraded).toBe(true);
    }, { timeout: 5000 });

    // La sesion de Lia se canjea igual: los chats siguen disponibles.
    await waitFor(() => {
      expect(result.current.session?.user?.id).toBe('lia-user-1');
    }, { timeout: 5000 });
    expect(result.current.liaDegraded).toBe(false);
  });

  it('AUTH-016: el directorio se recupera solo cuando SOFIA vuelve, sin tocar nada', async () => {
    sofiaMocks.getSession.mockResolvedValue(createStoredSofiaSession());
    sofiaMocks.fetchSofiaUserProfile.mockResolvedValue(null);

    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.sofiaContextDegraded).toBe(true);
    }, { timeout: 5000 });
    expect(result.current.sofiaContextRetryable).toBe(true);

    // Volver a la ventana adelanta el backoff: es el disparo que no obliga a
    // esperar los segundos del primer escalon.
    sofiaMocks.fetchSofiaUserProfile.mockResolvedValue(createProfileConMembresia());
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });

    await waitFor(() => {
      expect(result.current.sofiaContext?.currentOrganization?.id).toBe('org-1');
    }, { timeout: 5000 });
    expect(result.current.sofiaContextDegraded).toBe(false);
  });

  it('AUTH-015: una sesion sin token verificable pide volver a iniciar sesion, no reintentos', async () => {
    sofiaMocks.getSession.mockResolvedValue(createStoredSofiaSession(null));
    sofiaMocks.fetchSofiaUserProfile.mockResolvedValue(null);

    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.sofiaContextDegraded).toBe(true);
    }, { timeout: 5000 });

    expect(result.current.sofiaStatusMessage).toContain('Cierra sesion e inicia de nuevo');
    expect(result.current.sofiaContextRetryable).toBe(false);
    expect(sofiaMocks.signOut).not.toHaveBeenCalled();
  });

  it('AUTH-014: el reintento manual recupera el directorio sin reiniciar la app', async () => {
    sofiaMocks.getSession.mockResolvedValue(createStoredSofiaSession());
    sofiaMocks.fetchSofiaUserProfile.mockResolvedValue(null);

    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.sofiaContextDegraded).toBe(true);
    }, { timeout: 5000 });

    sofiaMocks.fetchSofiaUserProfile.mockResolvedValue(createProfileConMembresia());
    await act(async () => {
      await result.current.retrySofiaContext();
    });

    await waitFor(() => {
      expect(result.current.sofiaContext?.organizations).toHaveLength(1);
    }, { timeout: 5000 });
    expect(result.current.sofiaContextDegraded).toBe(false);
  });

  it('AUTH-011: un perfil valido sin membresia activa cierra la sesion', async () => {
    sofiaMocks.getSession.mockResolvedValue(createStoredSofiaSession());
    sofiaMocks.fetchSofiaUserProfile.mockResolvedValue({
      id: 'sofia-user-1',
      email: 'test@soflia.com',
      memberships: [],
      organizations: [],
      teams: [],
    });

    renderHook(() => useAuth(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(sofiaMocks.signOut).toHaveBeenCalled();
    }, { timeout: 5000 });

    // Denegacion real: no se reintenta.
    expect(sofiaMocks.fetchSofiaUserProfile).toHaveBeenCalledTimes(1);
  });

  it('AUTH-012: una restauracion valida mantiene al usuario autenticado con su contexto', async () => {
    sofiaMocks.getSession.mockResolvedValue(createStoredSofiaSession());
    sofiaMocks.fetchSofiaUserProfile.mockResolvedValue(createProfileConMembresia());

    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.sofiaContext?.currentOrganization?.id).toBe('org-1');
    }, { timeout: 5000 });

    expect(result.current.user?.id).toBe('sofia-user-1');
    expect(sofiaMocks.signOut).not.toHaveBeenCalled();
  });
});
