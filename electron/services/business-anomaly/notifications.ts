import type { UpcomingMeeting } from './types';

type NotifyWhatsApp = (payload: { message: string }) => void;

export async function sendPresentationAlert(
  whatsappClient: any,
  fallbackNotify: NotifyWhatsApp,
  event: UpcomingMeeting,
  clientName: string,
): Promise<void> {
  const message = `*Alerta Proactiva*: Tienes una reunion sobre "${event.title}" en menos de 2 horas. Revise la carpeta local "${clientName}" y no detecte archivos de presentacion (PPT/PDF) recientes. Deseas que genere un esquema automatico de apoyo para la reunion?`;

  if (!whatsappClient) {
    fallbackNotify({ message });
    return;
  }

  try {
    if (typeof whatsappClient.sendMessage === 'function') {
      await whatsappClient.sendMessage(message);
    } else if (typeof whatsappClient.sendText === 'function') {
      fallbackNotify({ message });
    }
  } catch (err: any) {
    console.error('[BusinessAnomalyMonitor] Error enviando alerta de WhatsApp:', err.message);
  }
}
