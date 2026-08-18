import type { WhatsAppService } from '../whatsapp-service';
import { normalizePhoneNumber } from '../whatsapp/phone-utils';
import { deliverAgentReply, type VoiceCallTransport } from '../voice-call/delivery';

/**
 * Identidad estable de un chat directo de WhatsApp, para indexar la sesion.
 *
 * NO se usa el JID: WhatsApp entrega a la misma persona unas veces como
 * `<lid>@lid` y otras como `<telefono>@s.whatsapp.net`, de modo que una sesion
 * abierta con una forma no se encontraba al buscarla con la otra y la llamada
 * parecia haberse cerrado sola. El telefono normalizado es el mismo en ambas.
 */
export function whatsAppVoiceSessionId(jid: string, senderNumber: string): string {
  return normalizePhoneNumber(senderNumber) || jid;
}

/**
 * Transporte de voz sobre WhatsApp.
 *
 * El modo llamada no conoce Baileys ni el JID: solo sabe pedir texto o audio por
 * un canal. Este adaptador es lo unico que traduce entre ambos.
 */
export function buildWhatsAppVoiceTransport(
  waService: WhatsAppService,
  jid: string,
  senderNumber: string,
): VoiceCallTransport {
  return {
    channel: 'whatsapp',
    chatId: whatsAppVoiceSessionId(jid, senderNumber),
    sendText: (text) => waService.sendText(jid, text),
    sendVoiceNote: (audio, seconds) => waService.sendVoiceNote(jid, audio, seconds),
  };
}

/**
 * Entrega la respuesta final del agente por WhatsApp, hablada o escrita.
 *
 * Solo se aplica a la respuesta del loop: los errores, las confirmaciones y los
 * resultados de comandos siguen saliendo por escrito, que es donde se leen sin
 * ambiguedad.
 */
export function deliverWhatsAppAgentReply(
  waService: WhatsAppService,
  jid: string,
  senderNumber: string,
  text: string,
  forceVoice = false,
): Promise<void> {
  return deliverAgentReply(buildWhatsAppVoiceTransport(waService, jid, senderNumber), text, { forceVoice });
}
