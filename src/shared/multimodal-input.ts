/**
 * Contrato compartido entre main y renderer para la entrada multimodal.
 *
 * Un `MediaRef` describe COMO viaja un medio al modelo, no donde vive: la
 * lista de data URLs anterior no podia expresar ni una referencia remota ni una
 * ventana temporal, y forzarlo habria producido cadenas con convenciones
 * implicitas. La union discriminada obliga al compilador a exigir el
 * tratamiento de cada ruta de transporte, incluida la de rechazo.
 */

export type MediaResolutionLevel = 'low' | 'medium' | 'high';

/** Medio incrustado en la peticion. Imagenes y audio corto. */
export interface InlineMediaRef {
  kind: 'inline';
  mimeType: string;
  base64: string;
  /** Duracion en segundos cuando se conoce; alimenta el presupuesto del turno. */
  durationSeconds?: number;
}

/** Archivo ya subido al proveedor por la API de archivos. */
export interface RemoteMediaRef {
  kind: 'remote';
  mimeType: string;
  uri: string;
  /** Momento en que el proveedor deja de servir el archivo. */
  expiresAt?: string;
  durationSeconds?: number;
  window?: MediaWindow;
}

/** Video publico direccionable que el proveedor descarga del lado servidor. */
export interface PublicVideoMediaRef {
  kind: 'public-video';
  uri: string;
  mimeType?: string;
  durationSeconds?: number;
  window?: MediaWindow;
  /** Cuadros por segundo solicitados al proveedor; su omision usa 1.0. */
  fps?: number;
}

/** Muestreo de un reproductor que no puede entregarse como video. */
export interface FramesMediaRef {
  kind: 'frames';
  frames: Array<{ base64: string; mimeType: string; atSeconds: number }>;
}

export type MediaRef = InlineMediaRef | RemoteMediaRef | PublicVideoMediaRef | FramesMediaRef;

export interface MediaWindow {
  startSeconds: number;
  endSeconds: number;
}

/** Motivo por el que un medio no pudo enviarse. Nunca se degrada en silencio. */
export type MediaRejectionReason =
  | 'formato-no-admitido'
  | 'excede-limite-proveedor'
  | 'tipo-indeterminado'
  | 'presupuesto-del-turno'
  | 'medio-vacio';

export interface MediaRejection {
  reason: MediaRejectionReason;
  /** Texto en español para el usuario; no incluye rutas locales ni credenciales. */
  detail: string;
}

/** Lo que el turno envio de verdad. Viaja al resultado de herramienta visible. */
export interface MediaEnvelope {
  /** Una entrada por medio aceptado, en el orden en que se envio. */
  sent: Array<{
    kind: MediaRef['kind'];
    mimeType?: string;
    /** Origen legible: URI publica, nombre del archivo o "captura del navegador". */
    source?: string;
    window?: MediaWindow;
    frameCount?: number;
  }>;
  rejected: MediaRejection[];
  /** Resolucion aplicada al turno; ausente cuando no viajo ningun medio. */
  resolution?: MediaResolutionLevel;
  /** Costo estimado en tokens de los medios enviados. */
  estimatedTokens: number;
}

/**
 * Presupuesto de medios por turno.
 *
 * El video cuesta del orden de cientos de tokens por segundo enviado. Sin
 * limites explicitos, una pregunta casual sobre un video de una hora produce un
 * turno de coste desproporcionado. Los valores viven aqui y se documentan en
 * `docs/architecture/runtime-parameters.md`, no dispersos por el codigo.
 */
export const MEDIA_BUDGET = {
  /** Ventana maxima de video que un turno puede enviar. */
  maxVideoWindowSeconds: 90,
  /** A partir de esta duracion la resolucion baja sola. */
  reducedResolutionThresholdSeconds: 20,
  /** Contexto previo a la posicion de reproduccion en una pregunta sobre el video. */
  windowLookBehindSeconds: 30,
  /** Margen posterior a la posicion de reproduccion. */
  windowLookAheadSeconds: 10,
  /** Cuadros del muestreo cuando el reproductor no es direccionable. */
  frameSampleCount: 6,
  /** Separacion entre cuadros del muestreo. */
  frameSampleIntervalSeconds: 2,
  /** Duracion maxima de una escucha ambiental. */
  maxAmbientAudioSeconds: 60,
  /** Presupuesto de tokens de medios por turno. */
  maxMediaTokensPerTurn: 30_000,
  /** Maximo de medios adjuntos en un mismo turno. */
  maxMediaPerTurn: 4,
  /** Duracion combinada maxima de los adjuntos de un turno. */
  maxCombinedDurationSeconds: 600,
  /** Tope de datos incrustados en la peticion; por encima se sube por archivo. */
  maxInlineBytes: 15 * 1024 * 1024,
  /** Tope de subida del proveedor. */
  maxUploadBytes: 2 * 1024 * 1024 * 1024,
} as const;

/**
 * Interruptores de reversion por capacidad.
 *
 * Con las tres en `false`, el producto vuelve exactamente al comportamiento de
 * captura fija anterior al cambio: sin herramientas de vision, sin adjuntos de
 * video/audio y sin escucha. La migracion de SDK es el unico paso que no se
 * revierte por parametro.
 */
export const MULTIMODAL_FEATURES = {
  /** Captura explicita y analisis de video de la pestaña activa. */
  browserVision: readFlag('VITE_MULTIMODAL_BROWSER_VISION'),
  /** Adjuntos de video y audio en el compositor del chat. */
  mediaAttachments: readFlag('VITE_MULTIMODAL_MEDIA_ATTACHMENTS'),
  /** Escucha puntual del audio del equipo o del microfono. */
  ambientAudio: readFlag('VITE_MULTIMODAL_AMBIENT_AUDIO'),
} as const;

/** Las capacidades vienen activas salvo que se apaguen explicitamente. */
function readFlag(name: string): boolean {
  const entorno = (import.meta as { env?: Record<string, string | undefined> }).env;
  return entorno?.[name] !== 'false';
}

/** Costo aproximado en tokens por segundo de video, segun resolucion. */
export const VIDEO_TOKENS_PER_SECOND: Record<MediaResolutionLevel, number> = {
  low: 100,
  medium: 300,
  high: 600,
};

/** Costo aproximado en tokens por segundo de audio. */
export const AUDIO_TOKENS_PER_SECOND = 32;

export const SUPPORTED_VIDEO_MIME_TYPES = [
  'video/mp4', 'video/mpeg', 'video/mov', 'video/quicktime', 'video/avi',
  'video/x-flv', 'video/mpg', 'video/webm', 'video/wmv', 'video/3gpp',
] as const;

export const SUPPORTED_AUDIO_MIME_TYPES = [
  'audio/wav', 'audio/x-wav', 'audio/mp3', 'audio/mpeg', 'audio/aiff',
  'audio/aac', 'audio/ogg', 'audio/flac',
] as const;

export const SUPPORTED_IMAGE_MIME_TYPES = [
  'image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif',
] as const;

export function isVideoMimeType(mimeType: string): boolean {
  return (SUPPORTED_VIDEO_MIME_TYPES as readonly string[]).includes(mimeType.toLowerCase());
}

export function isAudioMimeType(mimeType: string): boolean {
  return (SUPPORTED_AUDIO_MIME_TYPES as readonly string[]).includes(mimeType.toLowerCase());
}

export function isImageMimeType(mimeType: string): boolean {
  return (SUPPORTED_IMAGE_MIME_TYPES as readonly string[]).includes(mimeType.toLowerCase());
}

/** Formatos que el modelo acepta como entrada de medio. */
export function isSupportedMediaMimeType(mimeType: string): boolean {
  return isVideoMimeType(mimeType) || isAudioMimeType(mimeType) || isImageMimeType(mimeType);
}

/**
 * Recorta una ventana a los limites reales del medio.
 *
 * Sin esto, una pregunta hecha en el segundo 3 de un video producia un
 * desplazamiento de inicio negativo, y una hecha cerca del final pedia al
 * proveedor un tramo que no existe.
 */
export function clampWindow(window: MediaWindow, durationSeconds?: number): MediaWindow {
  const start = Math.max(0, Math.floor(window.startSeconds));
  let end = Math.max(start, Math.ceil(window.endSeconds));
  if (typeof durationSeconds === 'number' && Number.isFinite(durationSeconds) && durationSeconds > 0) {
    end = Math.min(end, Math.ceil(durationSeconds));
  }
  const maxEnd = start + MEDIA_BUDGET.maxVideoWindowSeconds;
  return { startSeconds: start, endSeconds: Math.max(start, Math.min(end, maxEnd)) };
}

/** Ventana centrada en la posicion de reproduccion, acotada al medio. */
export function buildPlaybackWindow(currentSeconds: number | null, durationSeconds?: number): MediaWindow {
  const position = typeof currentSeconds === 'number' && Number.isFinite(currentSeconds) && currentSeconds >= 0
    ? currentSeconds
    : 0;
  return clampWindow({
    startSeconds: position - MEDIA_BUDGET.windowLookBehindSeconds,
    endSeconds: position + MEDIA_BUDGET.windowLookAheadSeconds,
  }, durationSeconds);
}

export function windowDurationSeconds(window?: MediaWindow): number {
  if (!window) return 0;
  return Math.max(0, window.endSeconds - window.startSeconds);
}

/** Desplazamiento en el formato de segundos que espera el proveedor. */
export function toOffsetString(seconds: number): string {
  return `${Math.max(0, Math.round(seconds))}s`;
}
