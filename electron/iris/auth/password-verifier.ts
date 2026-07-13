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

export interface PasswordVerificationResult {
  success: boolean;
  error?: string;
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

  // Cierre local defensivo; el cliente efimero se descarta al salir del scope.
  await ephemeralClient.auth.signOut({ scope: 'local' }).catch(() => undefined);
  return { success: true };
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
