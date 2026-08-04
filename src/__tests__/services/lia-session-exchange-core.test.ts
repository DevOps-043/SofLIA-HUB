import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  exchangeSofiaSession,
  readBearerToken,
  type SessionExchangeDependencies,
} from '../../../database/lia/supabase/functions/_shared/sofia-session-exchange-core';

describe('Nucleo del intercambio federado SOFIA', () => {
  let dependencies: SessionExchangeDependencies;

  beforeEach(() => {
    dependencies = {
      getSofiaIdentity: vi.fn().mockResolvedValue({
        id: 'sofia-user-1',
        email: ' TEST@SOFLIA.COM ',
        emailVerified: true,
      }),
      hasActiveMembership: vi.fn().mockResolvedValue(true),
      generateOperationalAccess: vi.fn().mockResolvedValue({
        tokenHash: 'token-un-solo-uso',
        email: 'test@soflia.com',
      }),
    };
  });

  it('AUTH-029: solo acepta el formato bearer estricto', () => {
    expect(readBearerToken('Bearer token-valido')).toBe('token-valido');
    expect(readBearerToken('Basic token-valido')).toBeNull();
    expect(readBearerToken('Bearer token con espacios')).toBeNull();
    expect(readBearerToken(null)).toBeNull();
  });

  it('AUTH-030: token ausente se niega antes de cualquier operacion administrativa', async () => {
    const result = await exchangeSofiaSession(null, dependencies);

    expect(result).toEqual({ status: 401, body: { code: 'not_authenticated' } });
    expect(dependencies.getSofiaIdentity).not.toHaveBeenCalled();
    expect(dependencies.generateOperationalAccess).not.toHaveBeenCalled();
  });

  it('AUTH-031: identidad valida sin membresia activa no genera acceso', async () => {
    vi.mocked(dependencies.hasActiveMembership).mockResolvedValue(false);

    const result = await exchangeSofiaSession('Bearer token-sofia', dependencies);

    expect(result).toEqual({ status: 403, body: { code: 'access_denied' } });
    expect(dependencies.hasActiveMembership).toHaveBeenCalledWith('token-sofia', 'sofia-user-1');
    expect(dependencies.generateOperationalAccess).not.toHaveBeenCalled();
  });

  it('AUTH-034: un correo no verificado no puede tomar una cuenta operativa por coincidencia', async () => {
    vi.mocked(dependencies.getSofiaIdentity).mockResolvedValue({
      id: 'sofia-user-1',
      email: 'test@soflia.com',
      emailVerified: false,
    });

    const result = await exchangeSofiaSession('Bearer token-sofia', dependencies);

    expect(result).toEqual({ status: 401, body: { code: 'not_authenticated' } });
    expect(dependencies.hasActiveMembership).not.toHaveBeenCalled();
    expect(dependencies.generateOperationalAccess).not.toHaveBeenCalled();
  });

  it('AUTH-032: emite solo el hash para el correo verificado', async () => {
    const result = await exchangeSofiaSession('Bearer token-sofia', dependencies);

    expect(dependencies.generateOperationalAccess).toHaveBeenCalledWith('test@soflia.com');
    expect(result).toEqual({ status: 200, body: { tokenHash: 'token-un-solo-uso' } });
    expect(result.body).not.toHaveProperty('email');
    expect(result.body).not.toHaveProperty('userId');
  });

  it('AUTH-033: rechaza si el proveedor devuelve acceso para otro correo', async () => {
    vi.mocked(dependencies.generateOperationalAccess).mockResolvedValue({
      tokenHash: 'token-ajeno',
      email: 'otra@soflia.com',
    });

    const result = await exchangeSofiaSession('Bearer token-sofia', dependencies);

    expect(result).toEqual({ status: 503, body: { code: 'exchange_unavailable' } });
  });
});
