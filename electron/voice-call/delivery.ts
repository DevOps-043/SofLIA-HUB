import { readVoiceCallConfig } from './config';
import { voiceCallSessions } from './session-store';
import { synthesizeVoiceNote } from './speech';
import type { VoiceCallChannel, VoiceCallOpenReason } from './types';

/**
 * Lo minimo que un canal debe saber hacer para sostener una conversacion
 * hablada. WhatsApp y Telegram lo implementan con transportes distintos, y el
 * modo llamada no necesita conocer ninguno de los dos.
 */
export interface VoiceCallTransport {
  channel: VoiceCallChannel;
  /** JID en WhatsApp, `chat_id` en Telegram. */
  chatId: string;
  sendText: (text: string) => Promise<void>;
  sendVoiceNote: (audio: Buffer, seconds: number) => Promise<void>;
}

export interface DeliverOptions {
  /**
   * Habla aunque no haya sesion abierta. Lo usa el turno que llego por voz: si
   * el usuario hablo, esperar un comando previo para que le contesten hablando
   * seria un tramite inventado.
   */
  forceVoice?: boolean;
}

/**
 * Entrega la respuesta del agente por el canal, hablada o escrita.
 *
 * No razona ni decide contenido: el texto ya viene resuelto por el loop Gemini
 * con todas sus guardas. Aqui solo se elige la forma.
 */
export async function deliverAgentReply(
  transport: VoiceCallTransport,
  text: string,
  options: DeliverOptions = {},
): Promise<void> {
  const reply = String(text ?? '').trim();
  if (!reply) return;

  if (!shouldSpeak(transport, options)) {
    await transport.sendText(reply);
    return;
  }

  try {
    const note = await synthesizeVoiceNote(reply);
    await transport.sendVoiceNote(note.buffer, note.seconds);
    // El resto no hablado se entrega escrito: recortar la voz no autoriza a
    // perder contenido que el agente decidio incluir.
    if (note.remainderText) await transport.sendText(note.remainderText);
    voiceCallSessions.recordSpokenTurn(transport.channel, transport.chatId);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error(`[Voice Call] Fallo la sintesis en ${transport.channel}:${transport.chatId}: ${detail}`);
    // Perder la respuesta seria peor que perder la voz.
    await transport.sendText(reply);
    if (voiceCallSessions.claimDegradedNotice(transport.channel, transport.chatId)) {
      await transport.sendText(`(Sigo por escrito: ${detail})`);
    }
  }
}

function shouldSpeak(transport: VoiceCallTransport, options: DeliverOptions): boolean {
  if (!readVoiceCallConfig().enabled) return false;
  if (options.forceVoice) return true;
  return voiceCallSessions.isActive(transport.channel, transport.chatId);
}

/**
 * Abre el modo llamada y saluda hablando.
 *
 * El saludo va por la misma ruta de entrega que cualquier respuesta, asi que si
 * la voz no esta disponible el usuario recibe el aviso por escrito en vez de un
 * silencio que parecería una averia.
 */
export async function openVoiceCall(
  transport: VoiceCallTransport,
  reason: VoiceCallOpenReason,
): Promise<void> {
  voiceCallSessions.open(transport.channel, transport.chatId, reason);
  await deliverAgentReply(transport, buildGreeting(reason), { forceVoice: true });
}

/** Cierra el modo llamada. La despedida va escrita: la llamada ya termino. */
export async function closeVoiceCall(transport: VoiceCallTransport): Promise<boolean> {
  const session = voiceCallSessions.close(transport.channel, transport.chatId, 'command');
  if (!session) {
    await transport.sendText('No hay una llamada activa ahora mismo.');
    return false;
  }
  await transport.sendText(`Colgado. Hablamos ${session.spokenTurns === 1 ? 'una vez' : `${session.spokenTurns} veces`} en esta llamada.`);
  return true;
}

function buildGreeting(reason: VoiceCallOpenReason): string {
  if (reason === 'incoming-call') {
    return 'Hola, no puedo contestar la llamada de WhatsApp, pero ya estoy en modo llamada. Mandame una nota de voz y te respondo hablando. Puedo buscar en internet, usar mis herramientas y ejecutar acciones en tu computadora mientras hablamos. Escribe barra colgar cuando quieras terminar.';
  }
  if (reason === 'voice-message') {
    return 'Te escucho. Sigue mandandome notas de voz y te contesto hablando. Escribe barra colgar cuando quieras terminar.';
  }
  return 'Modo llamada activado. Hablame por nota de voz y te respondo con voz. Escribe barra colgar cuando quieras terminar.';
}
