import { beforeEach, describe, expect, it, vi } from 'vitest';

// El login ya no lee public.users: la instancia la cerro y la traduccion de
// identificador a correo pasa por una funcion acotada.
const supabaseMocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));

vi.mock('../../lib/sofia-client', () => ({
  sofiaSupa: { rpc: supabaseMocks.rpc, from: supabaseMocks.from },
  isSofiaConfigured: () => true,
}));

import {
  INVALID_CREDENTIALS_MESSAGE,
  mapSupabaseAuthError,
  resolveLoginEmail,
} from '../../services/sofia-auth/login';

describe('sofia-auth/login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabaseMocks.rpc.mockResolvedValue({ data: null, error: null });
  });

  describe('resolveLoginEmail', () => {
    it('resuelve el correo pasando el identificador tal cual a la funcion', async () => {
      supabaseMocks.rpc.mockResolvedValue({ data: 'fer@pulsehub.mx', error: null });

      const result = await resolveLoginEmail('Fer@PulseHub.mx');

      expect(supabaseMocks.rpc).toHaveBeenCalledWith('resolve_desktop_login_email', {
        identifier: 'Fer@PulseHub.mx',
      });
      expect(result).toBe('fer@pulsehub.mx');
    });

    it('acepta un nombre de usuario, no solo un correo', async () => {
      supabaseMocks.rpc.mockResolvedValue({ data: 'fer@pulsehub.mx', error: null });

      const result = await resolveLoginEmail('FerSG');

      expect(supabaseMocks.rpc).toHaveBeenCalledWith('resolve_desktop_login_email', { identifier: 'FerSG' });
      expect(result).toBe('fer@pulsehub.mx');
    });

    it('nunca consulta la tabla de usuarios', async () => {
      await resolveLoginEmail('FerSG');
      expect(supabaseMocks.from).not.toHaveBeenCalled();
    });

    it('devuelve null sin consultar cuando el identificador esta vacio', async () => {
      const result = await resolveLoginEmail('   ');
      expect(result).toBeNull();
      expect(supabaseMocks.rpc).not.toHaveBeenCalled();
    });

    it('devuelve null cuando el usuario no existe', async () => {
      const result = await resolveLoginEmail('noexiste@x.com');
      expect(result).toBeNull();
    });

    it('trata una cadena vacia devuelta por la funcion como usuario inexistente', async () => {
      supabaseMocks.rpc.mockResolvedValue({ data: '   ', error: null });
      await expect(resolveLoginEmail('fer@pulsehub.mx')).resolves.toBeNull();
    });

    it('lanza error ante fallos de consulta (conexion/BD/permisos)', async () => {
      supabaseMocks.rpc.mockResolvedValue({ data: null, error: { message: 'permission denied' } });
      await expect(resolveLoginEmail('fer@pulsehub.mx')).rejects.toThrow('No se pudo consultar el usuario');
    });
  });

  describe('mapSupabaseAuthError', () => {
    it('traduce credenciales invalidas sin revelar detalles', () => {
      expect(mapSupabaseAuthError('Invalid login credentials')).toBe(INVALID_CREDENTIALS_MESSAGE);
    });

    it('traduce email no confirmado', () => {
      expect(mapSupabaseAuthError('Email not confirmed')).toContain('no esta confirmado');
    });

    it('traduce rate limiting', () => {
      expect(mapSupabaseAuthError('Too many requests')).toContain('Demasiados intentos');
    });

    it('traduce errores de red', () => {
      expect(mapSupabaseAuthError('fetch failed')).toContain('conectar');
    });

    it('usa mensaje generico para errores desconocidos (anti-enumeracion)', () => {
      expect(mapSupabaseAuthError('algo raro interno')).toBe(INVALID_CREDENTIALS_MESSAGE);
      expect(mapSupabaseAuthError(undefined)).toBe(INVALID_CREDENTIALS_MESSAGE);
    });
  });
});
