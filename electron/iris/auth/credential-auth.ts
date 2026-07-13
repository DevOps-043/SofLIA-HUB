import { getSofiaClient } from '../clients';
import { setSession } from '../sessions';
import type { WhatsAppSession } from '../types';
import { ensureUserExistsInIris } from '../user-sync';
import { buildFullName, fetchUserTeamIds } from './helpers';
import { verifySofiaPassword } from './password-verifier';
import type { SofiaUser } from './types';

/** Escapa comodines de ilike para tratar el identificador como literal. */
function escapeIlikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/**
 * Resuelve email o username a la fila de public.users (mismo UUID que auth.users).
 * Espejo del flujo del renderer en src/services/sofia-auth/login.ts.
 */
async function findSofiaUserByIdentifier(identifier: string): Promise<SofiaUser | null> {
  const sofia = getSofiaClient();
  if (!sofia) return null;
  const value = identifier.trim();
  if (!value) return null;

  const column = value.includes('@') ? 'email' : 'username';
  const { data, error } = await sofia
    .from('users')
    .select('id, username, email, first_name, last_name, display_name, phone, profile_picture_url')
    .ilike(column, escapeIlikePattern(value))
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`No se pudo consultar el usuario: ${error.message}`);
  return (data as SofiaUser | null) ?? null;
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
    // 1. Resolver identificador a la fila de public.users.
    const sofiaUser = await findSofiaUserByIdentifier(emailOrUsername);
    if (!sofiaUser?.email) {
      // Mensaje generico: no revelar si la cuenta existe (anti-enumeracion).
      return { success: false, message: 'Credenciales invalidas.' };
    }

    // 2. Validar la contraseña contra Supabase Auth (fuente de verdad desde la
    //    migracion de SofLIA Learning; reemplaza al RPC authenticate_user).
    const verification = await verifySofiaPassword(sofiaUser.email, password);
    if (!verification.success) {
      return { success: false, message: verification.error || 'Credenciales invalidas.' };
    }
    const email = sofiaUser.email || emailOrUsername;
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
