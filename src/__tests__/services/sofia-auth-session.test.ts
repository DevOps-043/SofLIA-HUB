import { beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({
  getSession: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChange: vi.fn(),
}));

vi.mock('../../lib/sofia-client', () => ({
  isSofiaConfigured: () => true,
  sofiaSupa: { auth },
}));

vi.mock('../../services/sofia-auth/context', () => ({
  buildActiveSofiaContext: vi.fn(),
  createPseudoAuthUser: vi.fn(),
}));

vi.mock('../../services/sofia-auth/login', () => ({
  findLoginUserRow: vi.fn(),
  INVALID_CREDENTIALS_MESSAGE: 'Credenciales invalidas',
  mapSupabaseAuthError: vi.fn(),
}));

vi.mock('../../services/sofia-auth/profile', () => ({ fetchSofiaUserProfile: vi.fn() }));
vi.mock('../../services/sofia-auth/session-storage', () => ({ saveSofiaSession: vi.fn() }));

import { sofiaAuth } from '../../services/sofia-auth';

describe('restauracion verificable de SOFIA', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('no fabrica una sesion desde el snapshot local', async () => {
    localStorage.setItem('sofia-session', JSON.stringify({
      timestamp: Date.now(),
      user: { id: 'perfil-local', email: 'local@example.com' },
    }));
    auth.getSession.mockResolvedValue({ data: { session: null }, error: null });

    await expect(sofiaAuth.getSession()).resolves.toBeNull();
  });

  it('conserva una sesion real con credenciales', async () => {
    const session = { access_token: 'access', refresh_token: 'refresh', user: { id: 'user-1' } };
    auth.getSession.mockResolvedValue({ data: { session }, error: null });

    await expect(sofiaAuth.getSession()).resolves.toBe(session);
  });
});
