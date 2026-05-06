/**
 * Autenticación de usuarios de WhatsApp.
 *
 * Dos rutas:
 * 1. **Auto-auth por teléfono** (preferida): cruza el número del remitente
 *    contra `sofia.users.phone`. Si hay match, se autentica sin pedir password.
 * 2. **Auth por credenciales** (fallback): usa el RPC `authenticate_user` de
 *    SOFIA con email/username + password (igual que la app principal).
 *
 * En ambas rutas, tras autenticar se sincroniza el usuario en IRIS y se
 * cachean sus team memberships para acelerar futuros queries.
 */

import { getIrisClient, getSofiaClient } from './clients';
import { normalizePhone } from './phone';
import { getAllSessions, getSession, removeSession, setSession } from './sessions';
import type { WhatsAppSession } from './types';
import { ensureUserExistsInIris } from './user-sync';

interface SofiaUser {
  id: string;
  username?: string | null;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  display_name?: string | null;
  phone?: string | null;
  profile_picture_url?: string | null;
}

function buildFullName(user: SofiaUser, fallback?: string): string {
  return (
    user.display_name ||
    `${user.first_name || ''} ${user.last_name || ''}`.trim() ||
    user.username ||
    fallback ||
    user.email ||
    ''
  );
}

async function fetchUserTeamIds(userId: string): Promise<string[]> {
  const iris = getIrisClient();
  if (!iris) return [];
  try {
    const { data: memberships } = await iris
      .from('team_members')
      .select('team_id')
      .eq('user_id', userId);
    return (memberships || []).map((m) => m.team_id);
  } catch {
    return [];
  }
}

/**
 * Intenta autenticar automáticamente cruzando el número del remitente con
 * `sofia.users.phone`. Si ya existe sesión, devuelve la existente sin reverificar.
 */
export async function tryAutoAuthByPhone(
  senderPhoneNumber: string,
): Promise<{ success: boolean; session?: WhatsAppSession; message: string }> {
  const existing = getSession(senderPhoneNumber);
  if (existing) {
    return {
      success: true,
      session: existing,
      message: `Ya autenticado como ${existing.fullName}`,
    };
  }

  const sofia = getSofiaClient();
  if (!sofia) {
    return { success: false, message: 'Sistema de autenticación no disponible.' };
  }

  try {
    const normalizedSender = normalizePhone(senderPhoneNumber);
    console.log(
      `[IRIS-Main] Auto-auth: looking for phone matching "${senderPhoneNumber}" (normalized: ${normalizedSender})`,
    );

    const { data: users, error } = await sofia
      .from('users')
      .select('id, username, email, first_name, last_name, display_name, phone, profile_picture_url')
      .not('phone', 'is', null);

    if (error || !users || users.length === 0) {
      console.log('[IRIS-Main] Auto-auth: no users with phone numbers found');
      return { success: false, message: 'No se encontró un usuario con este número de teléfono.' };
    }

    const matched = users.find((u) => {
      if (!u.phone) return false;
      const userNorm = normalizePhone(u.phone);
      return (
        userNorm === normalizedSender ||
        normalizedSender.endsWith(userNorm) ||
        userNorm.endsWith(normalizedSender)
      );
    });

    if (!matched) {
      console.log(`[IRIS-Main] Auto-auth: no phone match found for ${normalizedSender}`);
      return {
        success: false,
        message: 'Tu número de WhatsApp no está registrado en el sistema.',
      };
    }

    console.log(`[IRIS-Main] Auto-auth: matched user ${matched.username} (${matched.email})`);

    const fullName = buildFullName(matched);
    await ensureUserExistsInIris(matched.id);
    const teamIds = await fetchUserTeamIds(matched.id);

    const session: WhatsAppSession = {
      phoneNumber: senderPhoneNumber,
      userId: matched.id,
      email: matched.email || '',
      fullName,
      username: matched.username || '',
      authenticatedAt: new Date().toISOString(),
      teamIds,
      autoDetected: true,
    };

    setSession(session);

    return {
      success: true,
      session,
      message: `¡Detectado automáticamente! Bienvenido/a, ${fullName}.`,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[IRIS-Main] Auto-auth error:', err);
    return { success: false, message: `Error al verificar identidad: ${message}` };
  }
}

/**
 * Autentica con credenciales explícitas vía SOFIA RPC `authenticate_user`.
 * Fallback cuando `tryAutoAuthByPhone` no encuentra match.
 */
export async function authenticateWhatsAppUser(
  phoneNumber: string,
  emailOrUsername: string,
  password: string,
): Promise<{ success: boolean; message: string; fullName?: string }> {
  const sofia = getSofiaClient();
  if (!sofia) {
    return { success: false, message: 'El sistema de autenticación no está disponible.' };
  }

  try {
    const { data: authResult, error: authError } = await sofia.rpc('authenticate_user', {
      p_identifier: emailOrUsername,
      p_password: password,
    });

    if (authError) {
      console.error('[IRIS-Main] authenticate_user RPC error:', authError);
      return { success: false, message: 'Error de conexión con el sistema.' };
    }

    if (!authResult?.success) {
      return { success: false, message: authResult?.error || 'Credenciales inválidas.' };
    }

    const sofiaUser: SofiaUser = authResult.user;
    const userId = sofiaUser.id;
    const email = sofiaUser.email || emailOrUsername;
    const fullName = buildFullName(sofiaUser, email);

    await ensureUserExistsInIris(userId);
    const teamIds = await fetchUserTeamIds(userId);

    const session: WhatsAppSession = {
      phoneNumber,
      userId,
      email,
      fullName,
      username: sofiaUser.username || email,
      authenticatedAt: new Date().toISOString(),
      teamIds,
      autoDetected: false,
    };

    setSession(session);

    return {
      success: true,
      message: `¡Autenticado exitosamente! Bienvenido/a, ${fullName}.`,
      fullName,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[IRIS-Main] Auth error:', err);
    return { success: false, message: `Error de autenticación: ${message}` };
  }
}

export function getWhatsAppSession(phoneNumber: string): WhatsAppSession | null {
  return getSession(phoneNumber);
}

export function logoutWhatsAppUser(phoneNumber: string): boolean {
  return removeSession(phoneNumber);
}

export function getAllWhatsAppSessions(): WhatsAppSession[] {
  return getAllSessions();
}
