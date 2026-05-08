import { composeProactiveMessage } from './ai-message';
import { collectProactiveData } from './data-collector';
import type { ProactiveRuntimeContext } from './types';

export async function triggerProactiveNow(
  context: ProactiveRuntimeContext,
  phoneNumber?: string,
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const { getAllWhatsAppSessions } = await import('../iris-data-main');
    let sessions = getAllWhatsAppSessions();

    if (phoneNumber) {
      sessions = sessions.filter((session: any) => session.phoneNumber === phoneNumber);
    }
    if (sessions.length === 0) {
      return { success: false, error: 'No hay sesiones de WhatsApp autenticadas.' };
    }
    if (!context.waService || !context.waService.isConnected()) {
      return { success: false, error: 'WhatsApp no está conectado.' };
    }

    for (const session of sessions) {
      const payload = await collectProactiveData(context, session);
      const message = await composeProactiveMessage(context.apiKey, payload);
      if (message) {
        await context.waService.sendText(`${session.phoneNumber}@s.whatsapp.net`, message);
      }
    }

    return { success: true, message: `Notificación enviada a ${sessions.length} usuario(s).` };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
