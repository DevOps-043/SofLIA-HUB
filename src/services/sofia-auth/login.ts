/**
 * Login de SOFIA via Supabase Auth (auth.users).
 *
 * Reemplaza al RPC `authenticate_user` (pgcrypto sobre public.users.password_hash),
 * que quedo obsoleto cuando SofLIA Learning migro las contraseñas a Supabase Auth.
 * Ver docs/MIGRACION-AUTH-SUPABASE-HUB.md para el contexto completo.
 *
 * El identificador de login puede ser correo o nombre de usuario, y
 * signInWithPassword exige el correo. Esa traduccion ocurre ANTES de tener
 * sesion, asi que no puede leer public.users: la instancia cerro esa tabla al
 * endurecerse, y reabrirla a la clave anon (que viaja dentro del ejecutable de
 * escritorio) expondria el directorio completo de usuarios. Se resuelve con la
 * funcion acotada `resolve_desktop_login_email`, que solo devuelve el correo.
 * Ver database/sofia-learning/migrations/desktop-users-read-access.sql.
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

/** Mensaje unico para credenciales/usuario invalido: evita enumeracion de cuentas. */
export const INVALID_CREDENTIALS_MESSAGE = 'Credenciales invalidas';

/**
 * Traduce un identificador de login (correo o nombre de usuario) al correo con
 * el que se autentica.
 *
 * Devuelve null si no corresponde a ninguna cuenta; lanza solo ante errores de
 * conexion o de la consulta. Quien llama trata ambos casos con el mismo mensaje
 * generico para no revelar si la cuenta existe.
 */
export async function resolveLoginEmail(identifier: string): Promise<string | null> {
  if (!sofiaSupa) return null;
  const value = identifier.trim();
  if (!value) return null;

  const { data, error } = await sofiaSupa.rpc('resolve_desktop_login_email', { identifier: value });
  if (error) throw new Error(`No se pudo consultar el usuario: ${error.message}`);
  return typeof data === 'string' && data.trim() ? data : null;
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
