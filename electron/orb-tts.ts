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
export async function synthesizeOrbSpeech(text: string, operation?: { assertCurrent(): void; signal: AbortSignal }): Promise<OrbSpeechAudio> {
  operation?.assertCurrent();
  operation?.signal.throwIfAborted();
  const speech = String(text || '').replace(/\s+/g, ' ').trim();
  if (!speech) throw new Error('No hay texto que sintetizar.');
  if (speech.length > ELEVENLABS_TTS_MAX_CHARS) {
    throw new Error(`La voz admite hasta ${ELEVENLABS_TTS_MAX_CHARS} caracteres por solicitud.`);
  }

  const controller = new AbortController();
  const signal = operation ? AbortSignal.any([controller.signal, operation.signal]) : controller.signal;
  const prepared = prepareSpeechText(speech, 'es');
  const timeout = setTimeout(() => controller.abort(), ORB_SPEECH_TIMEOUT_MS);
  try {
    const { response, config } = await requestElevenLabsSpeech({
      text: prepared.text,
      withTimestamps: false,
      signal,
      languageCode: 'es',
    });
    operation?.assertCurrent(); signal.throwIfAborted();
    if (!response.ok) {
      const detail = await readErrorDetail(response, signal);
      throw new Error(elevenLabsProviderError(response.status, detail));
    }
    const contentLength = Number(response.headers.get('content-length') || '0');
    if (Number.isFinite(contentLength) && contentLength > ORB_SPEECH_MAX_RESPONSE_BYTES) {
      void response.body?.cancel().catch(() => {});
      throw new Error('ElevenLabs devolvió un audio fuera de rango.');
    }
    const buffer = await readBounded(response, ORB_SPEECH_MAX_RESPONSE_BYTES, signal);
    operation?.assertCurrent(); signal.throwIfAborted();
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
    // eslint-disable-next-line preserve-caught-error
    if (signal.aborted) throw new Error('La síntesis de voz fue cancelada.');
    throw error;
  } finally {
    clearTimeout(timeout);
    controller.abort();
  }
}

async function readErrorDetail(response: Response, signal: AbortSignal): Promise<unknown> {
  const text = (await readBounded(response, 16_384, signal)).toString('utf8');
  try {
    const payload = JSON.parse(text) as { detail?: unknown };
    return payload.detail;
  } catch {
    return undefined;
  }
}

async function readBounded(response: Response, limit: number, signal: AbortSignal): Promise<Buffer> {
  if (!response.body) return Buffer.alloc(0);
  const reader = response.body.getReader(); const chunks: Buffer[] = []; let bytes = 0;
  let cancelled!: () => void;
  const aborted = new Promise<never>((_resolve, reject) => {
    cancelled = () => reject(new Error('La síntesis de voz fue cancelada.'));
    signal.addEventListener('abort', cancelled, { once: true }); if (signal.aborted) cancelled();
  });
  try {
    while (true) {
      signal.throwIfAborted(); const item = await Promise.race([reader.read(), aborted]);
      signal.throwIfAborted(); if (item.done) break;
      bytes += item.value.byteLength; if (bytes > limit) throw new Error('La respuesta de voz excede el límite permitido.');
      chunks.push(Buffer.from(item.value));
    }
    return Buffer.concat(chunks, bytes);
  } finally {
    signal.removeEventListener('abort', cancelled);
    void reader.cancel().catch(() => {}).finally(() => reader.releaseLock());
  }
}
