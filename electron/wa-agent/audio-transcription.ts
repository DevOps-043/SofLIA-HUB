import type { GoogleGenerativeAI } from '@google/generative-ai';
import { WA_MODEL } from './constants';

const TRANSCRIPTION_PROMPT =
  'Transcribe este audio a texto. Solo devuelve la transcripcion exacta de lo que dice la persona, sin agregar nada mas. Si no puedes entenderlo, responde con una cadena vacia.';

/** Formatos que el modelo acepta; cualquier otro se declara como OGG. */
const SUPPORTED_AUDIO_MIME = /^audio\/(?:ogg|mpeg|mp3|mp4|wav|webm|aac|flac|x-m4a)$/i;

/**
 * Transcribe audio recibido por un canal de mensajeria.
 *
 * El tipo declarado por el canal se respeta cuando el modelo lo admite: forzar
 * `audio/ogg` sobre un MP3 de Telegram degradaba la transcripcion.
 */
export async function transcribeChannelAudio(
  ai: GoogleGenerativeAI,
  audioBuffer: Buffer,
  mimetype = 'audio/ogg',
): Promise<string> {
  const model = ai.getGenerativeModel({ model: WA_MODEL });
  const result = await model.generateContent([
    {
      inlineData: {
        mimeType: normalizeAudioMime(mimetype),
        data: audioBuffer.toString('base64'),
      },
    },
    TRANSCRIPTION_PROMPT,
  ]);

  return result.response.text().trim();
}

/** WhatsApp siempre entrega notas de voz en OGG/Opus. */
export function transcribeWhatsAppAudio(ai: GoogleGenerativeAI, audioBuffer: Buffer): Promise<string> {
  return transcribeChannelAudio(ai, audioBuffer, 'audio/ogg');
}

function normalizeAudioMime(mimetype: string): string {
  const base = String(mimetype || '').split(';')[0].trim().toLowerCase();
  return SUPPORTED_AUDIO_MIME.test(base) ? base : 'audio/ogg';
}
