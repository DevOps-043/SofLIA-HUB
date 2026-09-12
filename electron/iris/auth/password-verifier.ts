/**
 * Verificacion de contraseñas contra Supabase Auth (auth.users) — Main Process.
 *
 * Reemplaza al RPC `authenticate_user` (pgcrypto sobre public.users.password_hash),
 * obsoleto desde que SofLIA Learning migro las contraseñas a Supabase Auth.
 * Ver docs/MIGRACION-AUTH-SUPABASE-HUB.md.
 *
 * Usa un cliente EFIMERO por verificacion (sin persistencia ni auto-refresh):
 * el cliente SOFIA memoizado sirve consultas de datos con la anon key y no debe
 * quedar autenticado como el ultimo usuario de WhatsApp que hizo login.
 */
import { createClient } from '@supabase/supabase-js';
import { getSofiaCredentials } from '../clients';
import type { SofiaUser } from './types';

export interface PasswordVerificationResult {
  success: boolean;
  error?: string;
  /** Perfil de quien acaba de autenticarse; null si la verificacion fallo. */
  user?: SofiaUser | null;
}

export async function verifySofiaPassword(email: string, password: string): Promise<PasswordVerificationResult> {
  const credentials = getSofiaCredentials();
  if (!credentials) {
    return { success: false, error: 'El sistema de autenticacion no esta disponible.' };
  }

  const ephemeralClient = createClient(credentials.url, credentials.key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data, error } = await ephemeralClient.auth.signInWithPassword({ email, password });
  if (error || !data?.user) {
    return { success: false, error: mapAuthErrorMessage(error?.message) };
  }

  // El perfil se lee aqui y no despues: public.users esta cerrada a lectura
  // directa, y `get_desktop_user_profile` solo devuelve la fila de auth.uid().
  // Este cliente efimero es el unico momento del proceso main con una sesion.
  const { data: perfil, error: perfilError } = await ephemeralClient.rpc('get_desktop_user_profile');
  const user = (Array.isArray(perfil) ? perfil[0] : perfil) as SofiaUser | null;
  if (perfilError) {
    console.error('[SOFIA-Main] No se pudo leer el perfil tras autenticar:', perfilError.message);
  }

  // Cierre local defensivo; el cliente efimero se descarta al salir del scope.
  await ephemeralClient.auth.signOut({ scope: 'local' }).catch(() => undefined);
  return { success: true, user: user ?? null };
}

function mapAuthErrorMessage(message: string | undefined): string {
  const normalized = (message || '').toLowerCase();
  if (normalized.includes('invalid login credentials')) return 'Credenciales invalidas.';
  if (normalized.includes('email not confirmed')) return 'Tu correo aun no esta confirmado. Contacta al administrador.';
  if (normalized.includes('too many requests') || normalized.includes('rate limit')) {
    return 'Demasiados intentos. Espera unos minutos e intenta de nuevo.';
  }
  return 'Credenciales invalidas.';
}
