import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ipcMain } from 'electron';

const sesion = vi.hoisted(() => ({
  applyHubSession: vi.fn(async () => 'aplicada' as const),
  revokeHubSession: vi.fn(async () => undefined),
}));
const projectHub = vi.hoisted(() => ({
  exchangeSofiaToken: vi.fn(async () => ({ success: true })),
  logout: vi.fn(async () => undefined),
}));

vi.mock('../main/hub-session', () => sesion);
vi.mock('../project-hub', () => ({ getProjectHubApiService: () => projectHub }));

import { registerAuthStateHandlers } from '../auth-state-handlers';
import { resetAuthStateForTests } from '../main/auth-state';

const ipcMainHarness = ipcMain as unknown as {
  _clearHandlers: () => void;
  _getHandler: (channel: string) => (event: unknown, ...args: unknown[]) => Promise<any>;
};

/** Invoca un handler registrado, como haria el renderer. */
function invocar(canal: string, ...args: unknown[]): Promise<any> {
  return ipcMainHarness._getHandler(canal)({ sender: { id: 1 } }, ...args);
}

describe('contrato del canal de estado de sesion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ipcMainHarness._clearHandlers();
    resetAuthStateForTests();
    registerAuthStateHandlers();
  });

  it('aplica la sesion cuando el renderer publica tokens', async () => {
    const resultado = await invocar('auth:set-state', {
      authenticated: true,
      userId: 'user-1',
      accessToken: 'acceso',
      refreshToken: 'refresco',
    });

    expect(resultado.ok).toBe(true);
    expect(sesion.applyHubSession).toHaveBeenCalledWith(
      { accessToken: 'acceso', refreshToken: 'refresco' },
      'user-1',
    );
  });

  it('NUNCA devuelve la credencial: ni al publicar ni al consultar', async () => {
    await invocar('auth:set-state', {
      authenticated: true,
      userId: 'user-1',
      accessToken: 'acceso',
      refreshToken: 'refresco',
    });

    const publicado = await invocar('auth:set-state', {
      authenticated: true,
      userId: 'user-1',
      accessToken: 'acceso',
      refreshToken: 'refresco',
    });
    const consultado = await invocar('auth:get-state');

    for (const respuesta of [JSON.stringify(publicado), JSON.stringify(consultado)]) {
      expect(respuesta).not.toContain('acceso');
      expect(respuesta).not.toContain('refresco');
    }
    expect(consultado).toEqual({ authenticated: true, userId: 'user-1' });
  });

  it('cerrar sesion revoca la credencial', async () => {
    await invocar('auth:set-state', {
      authenticated: true,
      userId: 'user-1',
      accessToken: 'acceso',
      refreshToken: 'refresco',
    });

    await invocar('auth:set-state', { authenticated: false, userId: null });

    expect(sesion.revokeHubSession).toHaveBeenCalled();
    expect(projectHub.logout).toHaveBeenCalled();
    expect(await invocar('auth:get-state')).toEqual({ authenticated: false, userId: null });
  });

  it('canjea el token SOFIA sin devolverlo al renderer', async () => {
    const result = await invocar('auth:set-state', {
      authenticated: true,
      userId: 'user-1',
      sofiaAccessToken: 'sofia-token-real',
    });
    expect(projectHub.exchangeSofiaToken).toHaveBeenCalledWith('sofia-token-real');
    expect(JSON.stringify(result)).not.toContain('sofia-token-real');
  });

  it('un payload sin tokens sigue siendo valido y deja a main como anonimo', async () => {
    const resultado = await invocar('auth:set-state', {
      authenticated: true,
      userId: 'user-1',
    });

    expect(resultado.ok).toBe(true);
    // Una version anterior del renderer no publica tokens: no se falla, se
    // opera sin identidad, que es el estado seguro.
    expect(sesion.applyHubSession).not.toHaveBeenCalled();
  });

  it('un payload invalido no cambia el estado', async () => {
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const resultado = await invocar('auth:set-state', { authenticated: 'si' });

    expect(resultado.ok).toBe(false);
    expect(sesion.applyHubSession).not.toHaveBeenCalled();
    aviso.mockRestore();
  });
});
