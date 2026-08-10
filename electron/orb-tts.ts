import {
  ELEVENLABS_TTS_MAX_CHARS,
  elevenLabsProviderError,
  requestElevenLabsSpeech,
} from './elevenlabs-tts';
import { prepareSpeechText } from './speech-text-normalizer';

export const ORB_SPEECH_TIMEOUT_MS = 30_000;
export const ORB_SPEECH_MAX_RESPONSE_BYTES = 16 * 1024 * 1024;

export interface OrbSpeechAudio {
  audioBase64: string;
  mimeType: 'audio/mpeg';
  voiceId: string;
  modelId: string;
}

/** Sintetiza la voz de la Orbe con ElevenLabs sin exponer la credencial al renderer. */
export async function synthesizeOrbSpeech(text: string): Promise<OrbSpeechAudio> {
  const speech = String(text || '').replace(/\s+/g, ' ').trim();
  if (!speech) throw new Error('No hay texto que sintetizar.');
  if (speech.length > ELEVENLABS_TTS_MAX_CHARS) {
    throw new Error(`La voz admite hasta ${ELEVENLABS_TTS_MAX_CHARS} caracteres por solicitud.`);
  }

  const controller = new AbortController();
  const prepared = prepareSpeechText(speech, 'es');
  const timeout = setTimeout(() => controller.abort(), ORB_SPEECH_TIMEOUT_MS);
  try {
    const { response, config } = await requestElevenLabsSpeech({
      text: prepared.text,
      withTimestamps: false,
      signal: controller.signal,
      languageCode: 'es',
    });
    if (!response.ok) {
      const detail = await readErrorDetail(response);
      throw new Error(elevenLabsProviderError(response.status, detail));
    }
    const contentLength = Number(response.headers.get('content-length') || '0');
    if (Number.isFinite(contentLength) && contentLength > ORB_SPEECH_MAX_RESPONSE_BYTES) {
      throw new Error('ElevenLabs devolvió un audio fuera de rango.');
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length || buffer.length > ORB_SPEECH_MAX_RESPONSE_BYTES) {
      throw new Error('ElevenLabs devolvió un audio fuera de rango.');
    }
    return {
      audioBase64: buffer.toString('base64'),
      mimeType: 'audio/mpeg',
      voiceId: config.voiceId,
      modelId: config.modelId,
    };
  } catch (error) {
    // El vencimiento del plazo es un desenlace propio, no el sintoma de `error`.
    // eslint-disable-next-line preserve-caught-error
    if (controller.signal.aborted) throw new Error('Tiempo agotado al sintetizar la voz con ElevenLabs.');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function readErrorDetail(response: Response): Promise<unknown> {
  const text = (await response.text()).slice(0, 16_384);
  try {
    const payload = JSON.parse(text) as { detail?: unknown };
    return payload.detail;
  } catch {
    return undefined;
  }
}
