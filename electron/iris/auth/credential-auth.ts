import { getSofiaClient } from '../clients';
import { setSession } from '../sessions';
import type { WhatsAppSession } from '../types';
import { ensureUserExistsInIris } from '../user-sync';
import { buildFullName, fetchUserTeamIds } from './helpers';
import type { SofiaUser } from './types';

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
    const { data: authResult, error: authError } = await sofia.rpc('authenticate_user', {
      p_identifier: emailOrUsername,
      p_password: password,
    });

    if (authError) {
      console.error('[IRIS-Main] authenticate_user RPC error:', authError);
      return { success: false, message: 'Error de conexion con el sistema.' };
    }
    if (!authResult?.success) {
      return { success: false, message: authResult?.error || 'Credenciales invalidas.' };
    }

    const sofiaUser: SofiaUser = authResult.user;
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
