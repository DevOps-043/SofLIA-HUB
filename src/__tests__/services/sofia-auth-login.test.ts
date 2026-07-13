import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock del cliente SOFIA: cadena users.select().ilike().limit().maybeSingle()
const supabaseMocks = vi.hoisted(() => {
  const maybeSingle = vi.fn();
  const limit = vi.fn(() => ({ maybeSingle }));
  const ilike = vi.fn(() => ({ limit }));
  const select = vi.fn(() => ({ ilike }));
  const from = vi.fn(() => ({ select }));
  return { maybeSingle, limit, ilike, select, from };
});

vi.mock('../../lib/sofia-client', () => ({
  sofiaSupa: { from: supabaseMocks.from },
  isSofiaConfigured: () => true,
}));

import {
  escapeIlikePattern,
  findLoginUserRow,
  INVALID_CREDENTIALS_MESSAGE,
  mapSupabaseAuthError,
} from '../../services/sofia-auth/login';

describe('sofia-auth/login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabaseMocks.maybeSingle.mockResolvedValue({ data: null, error: null });
  });

  describe('findLoginUserRow', () => {
    it('busca por email (case-insensitive) cuando el identificador contiene @', async () => {
      const row = { id: 'u1', username: 'fer', email: 'fer@pulsehub.mx' };
      supabaseMocks.maybeSingle.mockResolvedValue({ data: row, error: null });

      const result = await findLoginUserRow('Fer@PulseHub.mx');

      expect(supabaseMocks.from).toHaveBeenCalledWith('users');
      expect(supabaseMocks.ilike).toHaveBeenCalledWith('email', 'Fer@PulseHub.mx');
      expect(result).toEqual(row);
    });

    it('busca por username cuando el identificador no es un email', async () => {
      await findLoginUserRow('FerSG');
      expect(supabaseMocks.ilike).toHaveBeenCalledWith('username', 'FerSG');
    });

    it('escapa comodines de ilike para tratar el identificador como literal', async () => {
      await findLoginUserRow('user%_raro');
      expect(supabaseMocks.ilike).toHaveBeenCalledWith('username', 'user\\%\\_raro');
    });

    it('devuelve null sin consultar cuando el identificador esta vacio', async () => {
      const result = await findLoginUserRow('   ');
      expect(result).toBeNull();
      expect(supabaseMocks.from).not.toHaveBeenCalled();
    });

    it('devuelve null cuando el usuario no existe', async () => {
      const result = await findLoginUserRow('noexiste@x.com');
      expect(result).toBeNull();
    });

    it('lanza error ante fallos de consulta (conexion/BD)', async () => {
      supabaseMocks.maybeSingle.mockResolvedValue({ data: null, error: { message: 'timeout' } });
      await expect(findLoginUserRow('fer@pulsehub.mx')).rejects.toThrow('No se pudo consultar el usuario');
    });
  });

  describe('escapeIlikePattern', () => {
    it('escapa %, _ y backslash', () => {
      expect(escapeIlikePattern('a%b_c\\d')).toBe('a\\%b\\_c\\\\d');
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
