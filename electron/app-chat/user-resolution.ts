import { getWhatsAppSession, tryAutoAuthByPhone } from '../iris-data-main';
import { getSofiaClient } from './clients';
import type { ResolvedWhatsAppUser } from './types';

async function loadActiveOrganizationIds(userId: string): Promise<string[]> {
  const sofia = getSofiaClient();
  if (!sofia || !userId) {
    return [];
  }

  try {
    const { data, error } = await sofia
      .from('organization_users')
      .select('organization_id, status')
      .eq('user_id', userId)
      .eq('status', 'active');

    if (error) {
      console.warn('[AppChatService] No pude cargar organizaciones activas:', error.message);
      return [];
    }

    return Array.from(
      new Set((data || []).map((row: any) => String(row.organization_id || '').trim()).filter(Boolean)),
    );
  } catch (error) {
    console.warn('[AppChatService] Error cargando organizaciones activas:', error);
    return [];
  }
}

export async function resolveWhatsAppUser(phoneNumber: string): Promise<ResolvedWhatsAppUser> {
  let session = getWhatsAppSession(phoneNumber);
  if (!session) {
    const autoAuth = await tryAutoAuthByPhone(phoneNumber);
    if (autoAuth.success && autoAuth.session) {
      session = autoAuth.session;
    }
  }

  if (!session?.userId) {
    throw new Error(
      'No pude identificar tu cuenta de Pulse para acceder a tus conversaciones. Asegurate de tener tu numero ligado a tu perfil.',
    );
  }

  return {
    userId: session.userId,
    email: session.email || null,
    fullName: session.fullName || null,
    orgIds: await loadActiveOrganizationIds(session.userId),
  };
}
