/**
 * Configuracion del modo llamada.
 *
 * Se lee del entorno en cada consulta y no se cachea: `VOICE_CALL_ENABLED=false`
 * es la palanca de rollback, y una palanca que exige reiniciar la aplicacion no
 * sirve para apagar algo que esta molestando.
 */

/** Tope de caracteres que se sintetizan por turno; el resto se entrega escrito. */
export const VOICE_NOTE_MAX_CHARS = 1_200;

/** Plazo de sintesis. Por encima de esto, hablar deja de ser conversar. */
export const VOICE_NOTE_TIMEOUT_MS = 30_000;

/** Tope de audio aceptado del proveedor, alineado con el de la orbe. */
export const VOICE_NOTE_MAX_RESPONSE_BYTES = 16 * 1024 * 1024;

/** `opus_48000_64` son 64 kbps constantes, es decir 8 KiB por segundo. */
export const VOICE_NOTE_BYTES_PER_SECOND = 8_000;

const DEFAULT_IDLE_TIMEOUT_MS = 10 * 60 * 1000;
const MIN_IDLE_TIMEOUT_MS = 60 * 1000;
const MAX_IDLE_TIMEOUT_MS = 60 * 60 * 1000;

export interface VoiceCallConfig {
  enabled: boolean;
  idleTimeoutMs: number;
  /** Voz propia del modo llamada; vacia significa usar `ELEVENLABS_VOICE_ID`. */
  voiceId: string;
}

export function readVoiceCallConfig(): VoiceCallConfig {
  return {
    enabled: readFlag(process.env.VOICE_CALL_ENABLED, true),
    idleTimeoutMs: readIdleTimeout(process.env.VOICE_CALL_IDLE_TIMEOUT_MS),
    voiceId: readVoiceId(process.env.VOICE_CALL_VOICE_ID),
  };
}

/**
 * Ausente significa habilitado: el modo llamada es parte del producto, no una
 * prueba que haya que encender. Solo un `false` explicito lo apaga.
 */
function readFlag(value: string | undefined, fallback: boolean): boolean {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return fallback;
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  if (['true', '1', 'si', 'yes', 'on'].includes(normalized)) return true;
  return fallback;
}

function readIdleTimeout(value: string | undefined): number {
  const parsed = Number(value?.trim());
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_IDLE_TIMEOUT_MS;
  return Math.min(Math.max(parsed, MIN_IDLE_TIMEOUT_MS), MAX_IDLE_TIMEOUT_MS);
}

/**
 * Una voz mal escrita se descarta en vez de propagarse: el respaldo es la voz
 * global, que ya esta validada, y no un error que deje al usuario sin respuesta.
 */
function readVoiceId(value: string | undefined): string {
  const candidate = value?.trim() ?? '';
  return /^[A-Za-z0-9_-]{8,80}$/.test(candidate) ? candidate : '';
}
