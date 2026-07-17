/**
 * Login de SOFIA via Supabase Auth (auth.users).
 *
 * Reemplaza al RPC `authenticate_user` (pgcrypto sobre public.users.password_hash),
 * que quedo obsoleto cuando SofLIA Learning migro las contraseñas a Supabase Auth.
 * Ver docs/MIGRACION-AUTH-SUPABASE-HUB.md para el contexto completo.
 *
 * El identificador de login puede ser email o username: el perfil sigue viviendo
 * en public.users (mismo UUID que auth.users), por eso primero se resuelve la fila
 * del usuario y despues se valida la contraseña contra Supabase Auth.
 */
import { sofiaSupa } from '../../lib/sofia-client';

export interface SofiaLoginUserRow {
  id: string;
  username: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  display_name?: string | null;
  profile_picture_url?: string | null;
  platform_role?: string | null;
}

const LOGIN_USER_COLUMNS = 'id, username, email, first_name, last_name, display_name, profile_picture_url, platform_role';

/** Mensaje unico para credenciales/usuario invalido: evita enumeracion de cuentas. */
export const INVALID_CREDENTIALS_MESSAGE = 'Credenciales invalidas';

/** Escapa comodines de ilike para tratar el identificador como literal. */
export function escapeIlikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/**
 * Busca la fila de public.users por email o username (case-insensitive).
 * Devuelve null si no existe; lanza solo ante errores de conexion/consulta.
 */
export async function findLoginUserRow(identifier: string): Promise<SofiaLoginUserRow | null> {
  if (!sofiaSupa) return null;
  const value = identifier.trim();
  if (!value) return null;

  const column = value.includes('@') ? 'email' : 'username';
  const { data, error } = await sofiaSupa
    .from('users')
    .select(LOGIN_USER_COLUMNS)
    .ilike(column, escapeIlikePattern(value))
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`No se pudo consultar el usuario: ${error.message}`);
  return (data as SofiaLoginUserRow | null) ?? null;
}

/**
 * Traduce errores de Supabase Auth a mensajes seguros en español.
 * No expone detalles internos ni permite distinguir "usuario no existe"
 * de "contraseña incorrecta".
 */
export function mapSupabaseAuthError(message: string | undefined): string {
  const normalized = (message || '').toLowerCase();
  if (normalized.includes('invalid login credentials')) return INVALID_CREDENTIALS_MESSAGE;
  if (normalized.includes('email not confirmed')) {
    return 'Tu correo aun no esta confirmado. Contacta al administrador para activarlo.';
  }
  if (normalized.includes('too many requests') || normalized.includes('rate limit')) {
    return 'Demasiados intentos de inicio de sesion. Espera unos minutos e intenta de nuevo.';
  }
  if (normalized.includes('fetch') || normalized.includes('network') || normalized.includes('timeout')) {
    return 'No se pudo conectar con el servidor de autenticacion. Revisa tu conexion.';
  }
  return INVALID_CREDENTIALS_MESSAGE;
}
