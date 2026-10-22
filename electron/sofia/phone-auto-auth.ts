import { getSofiaClient } from './clients';
import { normalizePhone } from './phone';
import { getSession, setSession } from './sessions';
import type { WhatsAppSession } from './types';

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

    const { data: users, error } = await sofia
      .from('users')
      .select('id, username, email, first_name, last_name, display_name, phone, profile_picture_url')
      .not('phone', 'is', null);

    if (error || !users || users.length === 0) {
      return { success: false, message: 'No se encontro un usuario con este numero de telefono.' };
    }

    if (normalizedSender.length !== 10) return { success: false, message: 'El número de teléfono no es válido.' };
    const matches = users.filter((user) => {
      if (!user.phone) return false;
      const userNorm = normalizePhone(user.phone);
      return userNorm.length === 10 && userNorm === normalizedSender;
    });

    const matched = matches.length === 1 ? matches[0] : null;
    if (!matched) {
      return { success: false, message: 'Tu numero de WhatsApp no esta registrado en el sistema.' };
    }

    const fullName = matched.display_name || `${matched.first_name || ''} ${matched.last_name || ''}`.trim() || matched.username || matched.email || '';
    const session: WhatsAppSession = {
      phoneNumber: senderPhoneNumber,
      userId: matched.id,
      email: matched.email || '',
      fullName,
      username: matched.username || '',
      authenticatedAt: new Date().toISOString(),
      autoDetected: true,
    };

    setSession(session);
    return { success: true, session, message: `Detectado automaticamente. Bienvenido/a, ${fullName}.` };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[SOFIA] Error al identificar por teléfono:', err);
    return { success: false, message: `Error al verificar identidad: ${message}` };
  }
}
