import { closeVoiceCall, openVoiceCall } from '../../voice-call/delivery';
import { readVoiceCallConfig } from '../../voice-call/config';
import { voiceCallSessions } from '../../voice-call/session-store';
import { buildWhatsAppVoiceTransport, whatsAppVoiceSessionId } from '../voice-delivery';
import type { WhatsAppService } from '../../whatsapp-service';

/**
 * `/llamar` abre el modo llamada; `/colgar` lo cierra.
 *
 * Devuelven `null` cuando ya respondieron por su cuenta: el saludo sale hablado
 * por la ruta de entrega, y devolverlo tambien como texto lo duplicaria.
 */
export async function handleVoiceCallCommand(input: {
  command: string;
  jid: string;
  senderNumber: string;
  isGroup: boolean;
  waService: WhatsAppService;
}): Promise<string | null> {
  const transport = buildWhatsAppVoiceTransport(input.waService, input.jid, input.senderNumber);

  if (input.command === '/colgar') {
    await closeVoiceCall(transport);
    return null;
  }

  if (!readVoiceCallConfig().enabled) {
    return 'El modo llamada esta desactivado en esta instalacion.';
  }
  // En grupo la respuesta hablada quedaria audible para todos los participantes
  // sin que ninguno la pidiera.
  if (input.isGroup) {
    return 'El modo llamada solo funciona en chats directos. Escribeme por privado y te contesto hablando.';
  }
  if (voiceCallSessions.isActive('whatsapp', whatsAppVoiceSessionId(input.jid, input.senderNumber))) {
    return 'Ya estamos en llamada. Mandame una nota de voz y te contesto hablando.';
  }

  await openVoiceCall(transport, 'command');
  return null;
}
