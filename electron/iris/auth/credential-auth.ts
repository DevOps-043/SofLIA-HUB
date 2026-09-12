import { getSofiaClient } from '../clients';
import { setSession } from '../sessions';
import type { WhatsAppSession } from '../types';
import { ensureUserExistsInIris } from '../user-sync';
import { buildFullName, fetchUserTeamIds } from './helpers';
import { verifySofiaPassword } from './password-verifier';

/**
 * Traduce email o username al correo con el que se autentica.
 * Espejo del flujo del renderer en src/services/sofia-auth/login.ts: la tabla
 * public.users no es legible sin sesion, asi que antes de autenticar solo se
 * resuelve el correo, nunca el perfil completo.
 */
async function resolveLoginEmail(identifier: string): Promise<string | null> {
  const sofia = getSofiaClient();
  if (!sofia) return null;
  const value = identifier.trim();
  if (!value) return null;

  const { data, error } = await sofia.rpc('resolve_desktop_login_email', { identifier: value });
  if (error) throw new Error(`No se pudo consultar el usuario: ${error.message}`);
  return typeof data === 'string' && data.trim() ? data : null;
}

export async function authenticateWhatsAppUser(
  phoneNumber: string,
  emailOrUsername: string,
  password: string,
): Promise<{ success: boolean; message: string; fullName?: string }> {
  const sofia = getSofiaClient();
  if (!sofia) {
    return { success: false, message: 'El sistema de autenticacion no esta disponible.' };
  }

  try {
    // 1. Resolver identificador a correo (sin leer el perfil: no hay sesion).
    const resolvedEmail = await resolveLoginEmail(emailOrUsername);
    if (!resolvedEmail) {
      // Mensaje generico: no revelar si la cuenta existe (anti-enumeracion).
      return { success: false, message: 'Credenciales invalidas.' };
    }

    // 2. Validar la contraseña contra Supabase Auth (fuente de verdad desde la
    //    migracion de SofLIA Learning; reemplaza al RPC authenticate_user).
    //    La verificacion devuelve ademas el perfil, leido con esa misma sesion:
    //    es el unico momento del proceso main en que hay una sesion valida.
    const verification = await verifySofiaPassword(resolvedEmail, password);
    if (!verification.success) {
      return { success: false, message: verification.error || 'Credenciales invalidas.' };
    }
    const sofiaUser = verification.user;
    if (!sofiaUser?.id) {
      return { success: false, message: 'No se pudo cargar tu perfil. Intenta de nuevo en unos momentos.' };
    }
    const email = sofiaUser.email || resolvedEmail;
    const fullName = buildFullName(sofiaUser, email);
    await ensureUserExistsInIris(sofiaUser.id);
    const teamIds = await fetchUserTeamIds(sofiaUser.id);
    const session: WhatsAppSession = {
      phoneNumber,
      userId: sofiaUser.id,
      email,
      fullName,
      username: sofiaUser.username || email,
      authenticatedAt: new Date().toISOString(),
      teamIds,
      autoDetected: false,
    };

    setSession(session);
    return { success: true, message: `Autenticado exitosamente. Bienvenido/a, ${fullName}.`, fullName };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[IRIS-Main] Auth error:', err);
    return { success: false, message: `Error de autenticacion: ${message}` };
  }
}
