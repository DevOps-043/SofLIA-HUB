import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { createWrapper, resetAuthMocks, sofiaMocks, useAuth } from './setup';

// Sesion persistida que la app intenta restaurar al arrancar (p. ej. tras
// reiniciar la computadora).
function createStoredSofiaSession() {
  return {
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

  it('AUTH-010: un fallo transitorio de SOFIA conserva la sesion y degrada en vez de cerrar sesion', async () => {
    sofiaMocks.getSession.mockResolvedValue(createStoredSofiaSession());
    // SOFIA no disponible: el perfil vuelve null en todos los reintentos.
    sofiaMocks.fetchSofiaUserProfile.mockResolvedValue(null);

    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.user?.id).toBe('sofia-user-1');
    }, { timeout: 5000 });

    expect(sofiaMocks.signOut).not.toHaveBeenCalled();
    expect(result.current.liaDegraded).toBe(true);
    expect(result.current.liaStatusMessage).toContain('Tu sesion sigue activa');
    // Se reintenta antes de degradar.
    expect(sofiaMocks.fetchSofiaUserProfile.mock.calls.length).toBeGreaterThan(1);
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
