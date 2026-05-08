import { getSofiaClient } from '../clients';
import { normalizePhone } from '../phone';
import { getSession, setSession } from '../sessions';
import type { WhatsAppSession } from '../types';
import { ensureUserExistsInIris } from '../user-sync';
import { buildFullName, fetchUserTeamIds } from './helpers';

export async function tryAutoAuthByPhone(
  senderPhoneNumber: string,
): Promise<{ success: boolean; session?: WhatsAppSession; message: string }> {
  const existing = getSession(senderPhoneNumber);
  if (existing) {
    return { success: true, session: existing, message: `Ya autenticado como ${existing.fullName}` };
  }

  const sofia = getSofiaClient();
  if (!sofia) {
    return { success: false, message: 'Sistema de autenticacion no disponible.' };
  }

  try {
    const normalizedSender = normalizePhone(senderPhoneNumber);
    console.log(`[IRIS-Main] Auto-auth: looking for phone matching "${senderPhoneNumber}" (normalized: ${normalizedSender})`);

    const { data: users, error } = await sofia
      .from('users')
      .select('id, username, email, first_name, last_name, display_name, phone, profile_picture_url')
      .not('phone', 'is', null);

    if (error || !users || users.length === 0) {
      console.log('[IRIS-Main] Auto-auth: no users with phone numbers found');
      return { success: false, message: 'No se encontro un usuario con este numero de telefono.' };
    }

    const matched = users.find((user) => {
      if (!user.phone) return false;
      const userNorm = normalizePhone(user.phone);
      return userNorm === normalizedSender ||
        normalizedSender.endsWith(userNorm) ||
        userNorm.endsWith(normalizedSender);
    });

    if (!matched) {
      console.log(`[IRIS-Main] Auto-auth: no phone match found for ${normalizedSender}`);
      return { success: false, message: 'Tu numero de WhatsApp no esta registrado en el sistema.' };
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
    return { success: true, session, message: `Detectado automaticamente. Bienvenido/a, ${fullName}.` };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[IRIS-Main] Auto-auth error:', err);
    return { success: false, message: `Error al verificar identidad: ${message}` };
  }
}
