import { deliverAgentReply, openVoiceCall } from '../voice-call/delivery';
import { readVoiceCallConfig } from '../voice-call/config';
import { voiceCallSessions } from '../voice-call/session-store';
import { closeVoiceCall } from '../voice-call/delivery';
import type { VoiceCallTransport } from '../voice-call/delivery';
import type { TelegramRuntimeContext } from './types';

/**
 * Transporte de voz sobre Telegram. Mismo contrato que el de WhatsApp: el modo
 * llamada no distingue entre canales, solo pide texto o audio.
 */
export function buildTelegramVoiceTransport(
  context: TelegramRuntimeContext,
  chatId: string,
): VoiceCallTransport {
  return {
    channel: 'telegram',
    chatId,
    sendText: async (text) => { await context.sendMessage(chatId, text); },
    sendVoiceNote: async (audio, seconds) => { await context.sendVoice(chatId, audio, seconds); },
  };
}

/** Audio entrante de Telegram, ya sea nota de voz o archivo de audio. */
export interface TelegramIncomingAudio {
  fileId: string;
  mimetype: string;
}

/**
 * Extrae el audio de un update. Devuelve `null` si el mensaje no trae ninguno.
 *
 * `voice` es la nota de voz nativa; `audio` es un archivo musical o grabacion
 * adjunta. Ambos se tratan igual porque el usuario puede enviar cualquiera de
 * los dos para hablarle.
 */
export function extractTelegramAudio(message: any): TelegramIncomingAudio | null {
  const voice = message?.voice;
  if (voice?.file_id) {
    return { fileId: String(voice.file_id), mimetype: String(voice.mime_type || 'audio/ogg') };
  }
  const audio = message?.audio;
  if (audio?.file_id) {
    return { fileId: String(audio.file_id), mimetype: String(audio.mime_type || 'audio/mpeg') };
  }
  return null;
}

/**
 * Atiende una nota de voz: la descarga, la transcribe y la manda por la misma
 * ruta de agente que un mensaje escrito, para que herede prefiltro, permisos y
 * confirmaciones sin duplicar politica.
 */
export async function handleTelegramVoiceMessage(input: {
  context: TelegramRuntimeContext;
  chatId: string;
  isGroup: boolean;
  audio: TelegramIncomingAudio;
  runTurn: (transcription: string) => Promise<string>;
}): Promise<void> {
  const { context, chatId, isGroup } = input;
  const transcribe = context.deps?.transcribeAudio;
  if (!transcribe) {
    await context.sendMessage(chatId, 'Todavia no puedo escuchar notas de voz por aqui. Escribeme el mensaje.');
    return;
  }

  const transport = buildTelegramVoiceTransport(context, chatId);
  try {
    const buffer = await context.downloadFile(input.audio.fileId);
    const transcription = (await transcribe(buffer, input.audio.mimetype)).trim();
    if (!transcription) {
      await context.sendMessage(chatId, 'No pude entender el audio. Podrias repetirlo o escribirlo?');
      return;
    }

    console.log(`[Telegram] Nota de voz transcrita: "${transcription.slice(0, 60)}"`);
    // Hablarle abre la llamada, salvo en grupo: la respuesta hablada quedaria
    // audible para todos sin que ninguno la pidiera.
    if (!isGroup) voiceCallSessions.open('telegram', chatId, 'voice-message');

    const reply = await input.runTurn(transcription);
    await deliverAgentReply(transport, reply || 'No obtuve respuesta para eso.', { forceVoice: !isGroup });
  } catch (error) {
    console.error('[Telegram] Error procesando la nota de voz:', error);
    await context.sendMessage(chatId, 'No pude procesar el audio. Intenta enviar un mensaje de texto.');
  }
}

/** `/llamar` y `/colgar` en Telegram, con la misma politica que en WhatsApp. */
export async function handleTelegramVoiceCallCommand(input: {
  context: TelegramRuntimeContext;
  chatId: string;
  isGroup: boolean;
  command: string;
}): Promise<string | null> {
  const transport = buildTelegramVoiceTransport(input.context, input.chatId);

  if (input.command === '/colgar') {
    await closeVoiceCall(transport);
    return null;
  }

  if (!readVoiceCallConfig().enabled) return 'El modo llamada esta desactivado en esta instalacion.';
  if (input.isGroup) {
    return 'El modo llamada solo funciona en chats directos. Escribeme por privado y te contesto hablando.';
  }
  if (voiceCallSessions.isActive('telegram', input.chatId)) {
    return 'Ya estamos en llamada. Mandame una nota de voz y te contesto hablando.';
  }

  await openVoiceCall(transport, 'command');
  return null;
}
