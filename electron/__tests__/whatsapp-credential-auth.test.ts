import { beforeEach, describe, expect, it, vi } from 'vitest';

// El login de WhatsApp ya no puede leer public.users antes de autenticar: la
// instancia cerro esa tabla. Estas pruebas fijan el contrato nuevo.
const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
  verifySofiaPassword: vi.fn(),
  setSession: vi.fn(),
  ensureUserExistsInIris: vi.fn(),
  fetchUserTeamIds: vi.fn(),
}));

vi.mock('../iris/clients', () => ({
  getSofiaClient: () => ({ rpc: mocks.rpc, from: mocks.from }),
  getSofiaCredentials: () => ({ url: 'https://sofia.test', key: 'anon' }),
}));

vi.mock('../iris/auth/password-verifier', () => ({
  verifySofiaPassword: mocks.verifySofiaPassword,
}));

vi.mock('../iris/sessions', () => ({ setSession: mocks.setSession }));
vi.mock('../iris/user-sync', () => ({ ensureUserExistsInIris: mocks.ensureUserExistsInIris }));
vi.mock('../iris/auth/helpers', () => ({
  buildFullName: () => 'Fernando Prueba',
  fetchUserTeamIds: mocks.fetchUserTeamIds,
}));

import { authenticateWhatsAppUser } from '../iris/auth/credential-auth';

describe('login de WhatsApp contra SOFIA', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rpc.mockResolvedValue({ data: 'fer@pulsehub.mx', error: null });
    mocks.fetchUserTeamIds.mockResolvedValue([]);
    mocks.verifySofiaPassword.mockResolvedValue({
      success: true,
      user: { id: 'u1', username: 'fersg', email: 'fer@pulsehub.mx' },
    });
  });

  it('WACRED-001: resuelve el correo por funcion y nunca lee la tabla de usuarios', async () => {
    const result = await authenticateWhatsAppUser('+5215500000000', 'FerSG', 'secreta');

    expect(mocks.rpc).toHaveBeenCalledWith('resolve_desktop_login_email', { identifier: 'FerSG' });
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.verifySofiaPassword).toHaveBeenCalledWith('fer@pulsehub.mx', 'secreta');
    expect(result.success).toBe(true);
  });

  it('WACRED-002: el perfil sale de la verificacion, no de una consulta aparte', async () => {
    await authenticateWhatsAppUser('+5215500000000', 'FerSG', 'secreta');

    expect(mocks.setSession).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u1' }));
  });

  it('WACRED-003: un identificador desconocido responde generico y no verifica nada', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null });

    const result = await authenticateWhatsAppUser('+5215500000000', 'nadie', 'secreta');

    expect(result).toEqual({ success: false, message: 'Credenciales invalidas.' });
    expect(mocks.verifySofiaPassword).not.toHaveBeenCalled();
  });

  it('WACRED-004: sin perfil tras autenticar no se abre sesion', async () => {
    mocks.verifySofiaPassword.mockResolvedValue({ success: true, user: null });

    const result = await authenticateWhatsAppUser('+5215500000000', 'FerSG', 'secreta');

    expect(result.success).toBe(false);
    expect(mocks.setSession).not.toHaveBeenCalled();
  });
});
