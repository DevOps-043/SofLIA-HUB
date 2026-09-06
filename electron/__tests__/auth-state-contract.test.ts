import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ipcMain } from 'electron';

type SofiaMockResult = {
  status: 'aplicada' | 'sin-sesion' | 'rechazada' | 'no-disponible';
  userId: string | null;
};

const sesion = vi.hoisted(() => ({
  applyHubSession: vi.fn(async () => 'aplicada' as const),
  revokeHubSession: vi.fn(async () => undefined),
}));
const projectHub = vi.hoisted(() => ({
  exchangeSofiaToken: vi.fn(async () => ({ success: true })),
  logout: vi.fn(async () => undefined),
}));
const sesionSofia = vi.hoisted(() => ({
  currentUserId: null as string | null,
  applySofiaSession: vi.fn(async (_tokens: unknown, expectedUserId: string | null): Promise<SofiaMockResult> => ({
    status: 'aplicada' as const,
    userId: expectedUserId,
  })),
  revokeSofiaSession: vi.fn(async () => undefined),
  isSofiaMainSessionConfigured: vi.fn(() => true),
}));

vi.mock('../main/hub-session', () => sesion);
vi.mock('../main/sofia-session', () => ({
  applySofiaSession: sesionSofia.applySofiaSession,
  getSofiaSessionUserId: () => sesionSofia.currentUserId,
  isSofiaMainSessionConfigured: sesionSofia.isSofiaMainSessionConfigured,
  revokeSofiaSession: sesionSofia.revokeSofiaSession,
}));
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
    sesionSofia.currentUserId = null;
    sesionSofia.applySofiaSession.mockImplementation(async (_tokens, expectedUserId) => ({
      status: 'aplicada' as const,
      userId: expectedUserId,
    }));
    sesionSofia.isSofiaMainSessionConfigured.mockReturnValue(true);
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

  it('verifica la sesion SOFIA antes de habilitar el estado protegido', async () => {
    const resultado = await invocar('auth:set-state', {
      authenticated: true,
      userId: 'user-1',
      sofiaAccessToken: 'sofia-acceso',
      sofiaRefreshToken: 'sofia-refresco',
    });

    expect(sesionSofia.applySofiaSession).toHaveBeenCalledWith(
      { accessToken: 'sofia-acceso', refreshToken: 'sofia-refresco' },
      'user-1',
    );
    expect(resultado.state).toEqual({ authenticated: true, userId: 'user-1' });
  });

  it('NUNCA devuelve la credencial: ni al publicar ni al consultar', async () => {
    await invocar('auth:set-state', {
      authenticated: true,
      userId: 'user-1',
      accessToken: 'acceso',
      refreshToken: 'refresco',
      sofiaAccessToken: 'sofia-acceso',
      sofiaRefreshToken: 'sofia-refresco',
    });

    const publicado = await invocar('auth:set-state', {
      authenticated: true,
      userId: 'user-1',
      accessToken: 'acceso',
      refreshToken: 'refresco',
      sofiaAccessToken: 'sofia-acceso',
      sofiaRefreshToken: 'sofia-refresco',
    });
    const consultado = await invocar('auth:get-state');

    for (const respuesta of [JSON.stringify(publicado), JSON.stringify(consultado)]) {
      expect(respuesta).not.toContain('acceso');
      expect(respuesta).not.toContain('refresco');
      expect(respuesta).not.toContain('sofia-acceso');
      expect(respuesta).not.toContain('sofia-refresco');
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
    expect(sesionSofia.revokeSofiaSession).toHaveBeenCalled();
    expect(projectHub.logout).toHaveBeenCalled();
    expect(await invocar('auth:get-state')).toEqual({ authenticated: false, userId: null });
  });

  it('canjea el token SOFIA sin devolverlo al renderer', async () => {
    const result = await invocar('auth:set-state', {
      authenticated: true,
      userId: 'user-1',
      sofiaAccessToken: 'sofia-token-real',
      sofiaRefreshToken: 'sofia-refresh-real',
    });
    expect(projectHub.exchangeSofiaToken).toHaveBeenCalledWith('sofia-token-real');
    expect(JSON.stringify(result)).not.toContain('sofia-token-real');
  });

  it('un payload sin tokens SOFIA sigue siendo valido pero no habilita el gate', async () => {
    const resultado = await invocar('auth:set-state', {
      authenticated: true,
      userId: 'user-1',
    });

    expect(resultado.ok).toBe(true);
    // Una version anterior del renderer no publica tokens: no se falla, se
    // opera sin identidad, que es el estado seguro.
    expect(sesion.applyHubSession).not.toHaveBeenCalled();
    expect(resultado.state).toEqual({ authenticated: false, userId: null });
  });

  it('rechaza una identidad SOFIA que no coincide con el usuario declarado', async () => {
    sesionSofia.applySofiaSession.mockResolvedValueOnce({ status: 'rechazada', userId: null });

    const resultado = await invocar('auth:set-state', {
      authenticated: true,
      userId: 'user-declarado',
      sofiaAccessToken: 'sofia-acceso',
      sofiaRefreshToken: 'sofia-refresco',
    });

    expect(resultado.state).toEqual({ authenticated: false, userId: null });
  });

  it('conserva compatibilidad en instalaciones sin SOFIA configurado', async () => {
    sesionSofia.isSofiaMainSessionConfigured.mockReturnValueOnce(false);

    const resultado = await invocar('auth:set-state', {
      authenticated: true,
      userId: 'lia-user',
    });

    expect(resultado.state).toEqual({ authenticated: true, userId: 'lia-user' });
  });

  it('un payload invalido no cambia el estado', async () => {
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const resultado = await invocar('auth:set-state', { authenticated: 'si' });

    expect(resultado.ok).toBe(false);
    expect(sesion.applyHubSession).not.toHaveBeenCalled();
    aviso.mockRestore();
  });

  it('rechaza identidad vacia y pares de tokens incompletos', async () => {
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const sinUsuario = await invocar('auth:set-state', { authenticated: true, userId: '   ' });
    const sinRefresh = await invocar('auth:set-state', {
      authenticated: true,
      userId: 'user-1',
      sofiaAccessToken: 'solo-access',
    });

    expect(sinUsuario.ok).toBe(false);
    expect(sinRefresh.ok).toBe(false);
    expect(sesionSofia.applySofiaSession).not.toHaveBeenCalled();
    aviso.mockRestore();
  });
});
