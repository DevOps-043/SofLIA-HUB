import {
  ELEVENLABS_VOICE_NOTE_OUTPUT_FORMAT,
  elevenLabsProviderError,
  requestElevenLabsSpeech,
} from '../elevenlabs-tts';
import { prepareSpeechText } from '../speech-text-normalizer';
import {
  readVoiceCallConfig,
  VOICE_NOTE_BYTES_PER_SECOND,
  VOICE_NOTE_MAX_CHARS,
  VOICE_NOTE_MAX_RESPONSE_BYTES,
  VOICE_NOTE_TIMEOUT_MS,
} from './config';
import type { VoiceNoteAudio } from './types';

/**
 * Sintetiza una nota de voz lista para WhatsApp (`ptt`) y Telegram (`sendVoice`).
 *
 * Pide Opus en contenedor OGG directamente al proveedor porque es el unico
 * formato que ambos canales reproducen como nota de voz, y porque el repositorio
 * no empaqueta ffmpeg con el que transcodificar despues.
 */
export async function synthesizeVoiceNote(text: string): Promise<VoiceNoteAudio> {
  const { spoken, remainder } = splitForSpeech(text);
  if (!spoken) throw new Error('No hay texto que sintetizar.');

  const config = readVoiceCallConfig();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), VOICE_NOTE_TIMEOUT_MS);
  try {
    const { response, config: usedConfig } = await requestElevenLabsSpeech({
      text: prepareSpeechText(spoken, 'es').text,
      withTimestamps: false,
      signal: controller.signal,
      languageCode: 'es',
      outputFormat: ELEVENLABS_VOICE_NOTE_OUTPUT_FORMAT,
      voiceId: config.voiceId || undefined,
    });
    if (!response.ok) {
      throw new Error(elevenLabsProviderError(response.status, await readErrorDetail(response)));
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length || buffer.length > VOICE_NOTE_MAX_RESPONSE_BYTES) {
      throw new Error('ElevenLabs devolvió un audio fuera de rango.');
    }
    return {
      buffer,
      mimetype: 'audio/ogg; codecs=opus',
      seconds: estimateSeconds(buffer.length),
      spokenText: spoken,
      remainderText: remainder,
      voiceId: usedConfig.voiceId,
    };
  } catch (error) {
    // El vencimiento del plazo es un desenlace propio, no el sintoma de `error`.
    // eslint-disable-next-line preserve-caught-error
    if (controller.signal.aborted) throw new Error('Tiempo agotado al sintetizar la nota de voz.');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Parte la respuesta en lo que se habla y lo que queda escrito.
 *
 * Recortar en seco a mitad de palabra produce una nota que termina en un balbuceo,
 * asi que el corte busca hacia atras el final de una oracion y, si no lo halla, el
 * de una palabra. El resto no se descarta: lo entrega el llamador como texto.
 */
export function splitForSpeech(text: string): { spoken: string; remainder: string } {
  const normalized = String(text ?? '').replace(/\s+/gu, ' ').trim();
  if (normalized.length <= VOICE_NOTE_MAX_CHARS) return { spoken: normalized, remainder: '' };

  const window = normalized.slice(0, VOICE_NOTE_MAX_CHARS);
  const sentenceEnd = Math.max(window.lastIndexOf('. '), window.lastIndexOf('? '), window.lastIndexOf('! '));
  const cut = sentenceEnd > VOICE_NOTE_MAX_CHARS * 0.5 ? sentenceEnd + 1 : lastWordBoundary(window);
  return {
    spoken: normalized.slice(0, cut).trim(),
    remainder: normalized.slice(cut).trim(),
  };
}

function lastWordBoundary(window: string): number {
  const space = window.lastIndexOf(' ');
  return space > 0 ? space : window.length;
}

/**
 * Estimacion por bitrate constante. WhatsApp solo la usa para pintar la duracion
 * antes de descargar el audio, asi que aproximar evita depender de que Baileys
 * consiga leer los metadatos del contenedor.
 */
function estimateSeconds(byteLength: number): number {
  return Math.max(1, Math.round(byteLength / VOICE_NOTE_BYTES_PER_SECOND));
}

async function readErrorDetail(response: Response): Promise<unknown> {
  const text = (await response.text()).slice(0, 16_384);
  try {
    return (JSON.parse(text) as { detail?: unknown }).detail;
  } catch {
    return undefined;
  }
}
