export const ELEVENLABS_DEFAULT_MODEL_ID = 'eleven_turbo_v2_5';
export const ELEVENLABS_DEFAULT_OUTPUT_FORMAT = 'mp3_44100_128';
export const ELEVENLABS_TTS_MAX_CHARS = 5_000;

/**
 * Opus en contenedor OGG: el formato que WhatsApp acepta como nota de voz
 * (`ptt`) y Telegram como `sendVoice`, sin transcodificar. El repositorio no
 * empaqueta ffmpeg, asi que pedirselo ya listo al proveedor es lo que evita
 * arrastrar un codificador nativo por plataforma.
 */
export const ELEVENLABS_VOICE_NOTE_OUTPUT_FORMAT = 'opus_48000_64';

/**
 * Formatos que un llamador puede pedir por solicitud. La configuracion global
 * sigue restringida a MP3 porque es lo que la orbe reproduce con Web Audio; el
 * override existe para los canales que necesitan otro contenedor.
 */
const SUPPORTED_OUTPUT_FORMAT = /^(?:mp3_\d+_\d+|opus_\d+_\d+|pcm_\d+|ulaw_\d+)$/;

export interface ElevenLabsTtsConfig {
  apiKey: string;
  voiceId: string;
  modelId: string;
  outputFormat: string;
}

export function readElevenLabsTtsConfig(): ElevenLabsTtsConfig {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim() ?? '';
  const voiceId = process.env.ELEVENLABS_VOICE_ID?.trim() ?? '';
  if (!apiKey || !voiceId) {
    throw new Error('Configura ELEVENLABS_API_KEY y ELEVENLABS_VOICE_ID para habilitar la voz de SofLIA.');
  }
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(voiceId)) {
    throw new Error('ELEVENLABS_VOICE_ID no tiene un formato válido.');
  }
  const modelId = process.env.ELEVENLABS_MODEL_ID?.trim() || ELEVENLABS_DEFAULT_MODEL_ID;
  const outputFormat = process.env.ELEVENLABS_OUTPUT_FORMAT?.trim() || ELEVENLABS_DEFAULT_OUTPUT_FORMAT;
  if (!/^[a-z0-9_-]{3,80}$/i.test(modelId) || !/^mp3_\d+_\d+$/.test(outputFormat)) {
    throw new Error('La configuración de ElevenLabs no es válida.');
  }
  return { apiKey, voiceId, modelId, outputFormat };
}

export async function requestElevenLabsSpeech(input: {
  text: string;
  withTimestamps: boolean;
  signal: AbortSignal;
  languageCode?: string;
  previousText?: string;
  nextText?: string;
  /** Sobrescribe el formato configurado para esta solicitud (p. ej. Opus para notas de voz). */
  outputFormat?: string;
  /** Sobrescribe la voz configurada, para dar al modo llamada una voz propia. */
  voiceId?: string;
}): Promise<{ response: Response; config: ElevenLabsTtsConfig }> {
  const text = input.text.trim();
  if (!text) throw new Error('No hay texto que sintetizar.');
  if (text.length > ELEVENLABS_TTS_MAX_CHARS) {
    throw new Error(`Cada solicitud de voz admite hasta ${ELEVENLABS_TTS_MAX_CHARS} caracteres.`);
  }
  const config = applyRequestOverrides(readElevenLabsTtsConfig(), input.outputFormat, input.voiceId);
  const languageCode = normalizeLanguageCode(input.languageCode);
  const previousText = normalizeContext(input.previousText);
  const nextText = normalizeContext(input.nextText);
  const body: Record<string, unknown> = {
    text,
    model_id: config.modelId,
    apply_text_normalization: 'auto',
  };
  if (languageCode) body.language_code = languageCode;
  if (previousText) body.previous_text = previousText;
  if (nextText) body.next_text = nextText;
  const suffix = input.withTimestamps ? '/with-timestamps' : '';
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(config.voiceId)}${suffix}?output_format=${encodeURIComponent(config.outputFormat)}`,
    {
      method: 'POST',
      signal: input.signal,
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': config.apiKey,
      },
      body: JSON.stringify(body),
    },
  );
  return { response, config };
}

/**
 * El override es opcional: sin el, la configuracion global manda. Validarlo aqui
 * evita que un formato invalido llegue a la URL del proveedor.
 */
function applyRequestOverrides(
  config: ElevenLabsTtsConfig,
  outputFormat: string | undefined,
  voiceId: string | undefined,
): ElevenLabsTtsConfig {
  const result = { ...config };
  const requestedFormat = outputFormat?.trim();
  if (requestedFormat) {
    if (!SUPPORTED_OUTPUT_FORMAT.test(requestedFormat)) {
      throw new Error('El formato de audio solicitado no es válido.');
    }
    result.outputFormat = requestedFormat;
  }
  const requestedVoice = voiceId?.trim();
  if (requestedVoice) {
    if (!/^[A-Za-z0-9_-]{8,80}$/.test(requestedVoice)) {
      throw new Error('El identificador de voz solicitado no tiene un formato válido.');
    }
    result.voiceId = requestedVoice;
  }
  return result;
}

function normalizeLanguageCode(value: string | undefined): string {
  const primary = value?.trim().toLowerCase().split(/[-_]/u)[0] ?? '';
  return /^[a-z]{2}$/u.test(primary) ? primary : '';
}

function normalizeContext(value: string | undefined): string {
  return String(value ?? '').replace(/\s+/gu, ' ').trim().slice(0, 600);
}

export function elevenLabsProviderError(status: number, detail?: unknown): string {
  const code = readElevenLabsErrorCode(detail);
  if (code === 'voice_not_found' || code === 'voice_access_denied' || status === 404) {
    return 'ElevenLabs no encontró la voz configurada. Verifica que ELEVENLABS_VOICE_ID pertenezca al mismo workspace que ELEVENLABS_API_KEY.';
  }
  if (code === 'model_not_found' || code === 'unsupported_model' || code === 'model_access_denied') {
    return 'El modelo configurado no está disponible para esta clave de ElevenLabs. Verifica ELEVENLABS_MODEL_ID.';
  }
  if (code === 'invalid_output_format' || code === 'unsupported_output_format') {
    return 'ElevenLabs rechazó el formato de audio configurado. Verifica ELEVENLABS_OUTPUT_FORMAT.';
  }
  if (status === 402 || code === 'insufficient_credits' || code === 'quota_exceeded') {
    return 'La cuenta de ElevenLabs no tiene créditos disponibles para generar audio.';
  }
  if (status === 401) return 'ElevenLabs rechazó la credencial configurada.';
  if (status === 403) return 'La clave de ElevenLabs no tiene permiso de texto a voz o su acceso está restringido.';
  if (status === 429) return 'ElevenLabs alcanzó el límite de uso. Intenta más tarde.';
  if (status >= 500) return 'ElevenLabs no está disponible temporalmente.';
  return `ElevenLabs rechazó la solicitud (${status}).`;
}

function readElevenLabsErrorCode(detail: unknown, depth = 0): string {
  if (!detail || typeof detail !== 'object' || depth > 2) return '';
  const value = detail as Record<string, unknown>;
  for (const field of ['code', 'status', 'type'] as const) {
    const candidate = value[field];
    if (typeof candidate === 'string' && /^[a-z0-9_-]{2,80}$/i.test(candidate)) {
      return candidate.toLowerCase();
    }
  }
  return readElevenLabsErrorCode(value.detail, depth + 1);
}
