import {
  AUDIO_TOKENS_PER_SECOND,
  MEDIA_BUDGET,
  VIDEO_TOKENS_PER_SECOND,
  clampWindow,
  isAudioMimeType,
  isSupportedMediaMimeType,
  isVideoMimeType,
  toOffsetString,
  windowDurationSeconds,
  type MediaEnvelope,
  type MediaRef,
  type MediaRejection,
  type MediaResolutionLevel,
  type MediaWindow,
} from '../../shared/multimodal-input';

/**
 * Construye el contenido multimodal del turno.
 *
 * Devuelve tambien un `MediaEnvelope` con lo que se envio de verdad: la fuente,
 * el intervalo y la resolucion. Ese sobre viaja al resultado de herramienta
 * visible para que el usuario —y el propio modelo— sepan sobre que evidencia se
 * esta respondiendo, en lugar de deducirlo.
 */
export interface BuiltMessageContent {
  content: any;
  envelope: MediaEnvelope;
}

export function buildMultimodalContent(
  finalMessage: string,
  media: MediaRef[] = [],
  requestedResolution?: MediaResolutionLevel,
): BuiltMessageContent {
  const envelope: MediaEnvelope = { sent: [], rejected: [], estimatedTokens: 0 };
  if (!media.length) return { content: finalMessage, envelope };

  const { aceptados, rechazados } = partitionBySupport(media);
  envelope.rejected.push(...rechazados);

  const ajustado = fitWithinBudget(aceptados, resolveTurnResolution(aceptados, requestedResolution));
  const { parts, sent, presupuestoExcedido, tokens } = buildParts(ajustado.media, ajustado.resolution);
  envelope.sent.push(...sent);
  envelope.rejected.push(...presupuestoExcedido);
  envelope.estimatedTokens = tokens;
  if (sent.length) envelope.resolution = ajustado.resolution;

  return {
    content: parts.length ? [finalMessage, ...parts] : finalMessage,
    envelope,
  };
}

const RESOLUTION_LADDER: MediaResolutionLevel[] = ['high', 'medium', 'low'];
/** Por debajo de esto una ventana deja de ser evidencia util. */
const MIN_WINDOW_SECONDS = 8;

/**
 * Degradacion ordenada ante un presupuesto excedido, en el orden que fija la
 * especificacion: primero baja la resolucion, luego acorta la ventana y solo
 * entonces se excluye un medio (eso ultimo ocurre en `buildParts`).
 *
 * Sin este paso, un turno con resolucion alta pedida explicitamente rechazaba
 * el medio entero en vez de entregarlo con menos detalle, que es justo la
 * evidencia que el usuario pidio.
 */
function fitWithinBudget(
  media: MediaRef[],
  resolution: MediaResolutionLevel,
): { media: MediaRef[]; resolution: MediaResolutionLevel } {
  let nivel = resolution;
  while (totalTokens(media, nivel) > MEDIA_BUDGET.maxMediaTokensPerTurn) {
    const siguiente = RESOLUTION_LADDER[RESOLUTION_LADDER.indexOf(nivel) + 1];
    if (!siguiente) break;
    nivel = siguiente;
  }
  if (totalTokens(media, nivel) <= MEDIA_BUDGET.maxMediaTokensPerTurn) return { media, resolution: nivel };

  // Sigue sin caber: acorta proporcionalmente las ventanas de video, sin bajar
  // de un minimo por debajo del cual la ventana ya no informa nada.
  const factor = MEDIA_BUDGET.maxMediaTokensPerTurn / totalTokens(media, nivel);
  return { media: media.map((ref) => shrinkWindow(ref, factor)), resolution: nivel };
}

function shrinkWindow(ref: MediaRef, factor: number): MediaRef {
  if (ref.kind !== 'public-video' && ref.kind !== 'remote') return ref;
  if (!ref.window) return ref;
  const duracion = windowDurationSeconds(ref.window);
  const nueva = Math.max(MIN_WINDOW_SECONDS, Math.floor(duracion * factor));
  if (nueva >= duracion) return ref;
  // Se conserva el final de la ventana: en una pregunta sobre lo que se esta
  // viendo, el instante actual importa mas que el contexto previo.
  return {
    ...ref,
    window: { startSeconds: ref.window.endSeconds - nueva, endSeconds: ref.window.endSeconds },
  };
}

function totalTokens(media: MediaRef[], resolution: MediaResolutionLevel): number {
  return media.reduce((total, ref) => total + estimateTokens(ref, resolution), 0);
}

/**
 * Compatibilidad con los call sites que aun entregan data URLs sueltas
 * (orbe, procesador de chat, observacion del navegador). Normalizarlas aqui
 * evita cambiar sus firmas en este cambio.
 */
export function normalizeImagesToMediaRefs(images?: string[]): MediaRef[] {
  if (!images?.length) return [];
  return images
    .map((dataUrl): MediaRef | null => {
      const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (!match) return null;
      let mimeType = match[1];
      // Adjuntos de texto que llegaban como octet-stream se leian como binario.
      if (mimeType === 'application/octet-stream' || mimeType.includes('markdown')) mimeType = 'text/plain';
      return { kind: 'inline', mimeType, base64: match[2] };
    })
    .filter((ref): ref is MediaRef => ref !== null);
}

/** Firma anterior, conservada para los call sites que solo envian imagenes. */
export function buildMessageContent(finalMessage: string, images?: string[]): any {
  return buildMultimodalContent(finalMessage, normalizeImagesToMediaRefs(images)).content;
}

function partitionBySupport(media: MediaRef[]): { aceptados: MediaRef[]; rechazados: MediaRejection[] } {
  const aceptados: MediaRef[] = [];
  const rechazados: MediaRejection[] = [];

  for (const ref of media) {
    if (ref.kind === 'frames') {
      if (!ref.frames.length) {
        rechazados.push({ reason: 'medio-vacio', detail: 'El muestreo de cuadros no produjo ninguna imagen utilizable.' });
        continue;
      }
      aceptados.push(ref);
      continue;
    }

    if (ref.kind === 'public-video') {
      aceptados.push(ref);
      continue;
    }

    const mimeType = (ref.mimeType || '').toLowerCase();
    if (!mimeType) {
      rechazados.push({ reason: 'tipo-indeterminado', detail: 'No pude determinar el tipo de un archivo adjunto, asi que no lo envie.' });
      continue;
    }
    // El texto plano no es un medio: viaja como parte de texto sin restriccion.
    if (mimeType.startsWith('text/')) {
      aceptados.push(ref);
      continue;
    }
    if (!isSupportedMediaMimeType(mimeType)) {
      rechazados.push({
        reason: 'formato-no-admitido',
        detail: `El formato ${mimeType} no puede analizarse; convierte el archivo a un formato admitido.`,
      });
      continue;
    }
    if (ref.kind === 'inline' && estimateBase64Bytes(ref.base64) > MEDIA_BUDGET.maxInlineBytes) {
      rechazados.push({
        reason: 'excede-limite-proveedor',
        detail: 'El archivo supera el tamaño que admite un envio directo; debe subirse antes de analizarse.',
      });
      continue;
    }
    aceptados.push(ref);
  }

  return { aceptados, rechazados };
}

/**
 * Resolucion efectiva del turno.
 *
 * La peticion explicita manda —leer texto pequeño o cifras necesita detalle—,
 * pero una ventana larga baja sola a la resolucion reducida: sin eso, una
 * pregunta casual sobre un video largo consume el presupuesto entero.
 */
function resolveTurnResolution(media: MediaRef[], requested?: MediaResolutionLevel): MediaResolutionLevel {
  if (requested) return requested;
  const duracionVideo = media.reduce((total, ref) => total + videoSeconds(ref), 0);
  if (duracionVideo > MEDIA_BUDGET.reducedResolutionThresholdSeconds) return 'low';
  return 'medium';
}

function buildParts(media: MediaRef[], resolution: MediaResolutionLevel): {
  parts: any[];
  sent: MediaEnvelope['sent'];
  presupuestoExcedido: MediaRejection[];
  tokens: number;
} {
  const parts: any[] = [];
  const sent: MediaEnvelope['sent'] = [];
  const presupuestoExcedido: MediaRejection[] = [];
  let tokens = 0;

  for (const ref of media) {
    const costo = estimateTokens(ref, resolution);
    // Degradacion ordenada: la resolucion y la ventana ya se acotaron antes de
    // llegar aqui, asi que lo unico que queda es excluir el medio y decirlo.
    if (tokens + costo > MEDIA_BUDGET.maxMediaTokensPerTurn) {
      presupuestoExcedido.push({
        reason: 'presupuesto-del-turno',
        detail: `Un medio quedo fuera del turno por presupuesto (${describeRef(ref)}). Pidemelo por separado y lo analizo.`,
      });
      continue;
    }
    tokens += costo;

    switch (ref.kind) {
      case 'inline': {
        parts.push({ inlineData: { mimeType: ref.mimeType, data: ref.base64 } });
        sent.push({ kind: 'inline', mimeType: ref.mimeType });
        break;
      }
      case 'remote': {
        const window = ref.window ? clampWindow(ref.window, ref.durationSeconds) : undefined;
        parts.push(buildFilePart(ref.uri, ref.mimeType, window));
        sent.push({ kind: 'remote', mimeType: ref.mimeType, source: ref.uri, window });
        break;
      }
      case 'public-video': {
        const window = ref.window ? clampWindow(ref.window, ref.durationSeconds) : undefined;
        parts.push(buildFilePart(ref.uri, ref.mimeType || 'video/mp4', window, ref.fps));
        sent.push({ kind: 'public-video', mimeType: ref.mimeType, source: ref.uri, window });
        break;
      }
      case 'frames': {
        for (const frame of ref.frames) {
          parts.push({ inlineData: { mimeType: frame.mimeType, data: frame.base64 } });
        }
        sent.push({ kind: 'frames', frameCount: ref.frames.length, source: 'captura del navegador' });
        break;
      }
    }
  }

  return { parts, sent, presupuestoExcedido, tokens };
}

function buildFilePart(uri: string, mimeType: string, window?: MediaWindow, fps?: number): any {
  const part: any = { fileData: { fileUri: uri, mimeType } };
  if (window) {
    part.videoMetadata = {
      startOffset: toOffsetString(window.startSeconds),
      endOffset: toOffsetString(window.endSeconds),
    };
    if (typeof fps === 'number' && fps > 0) part.videoMetadata.fps = fps;
  }
  return part;
}

function estimateTokens(ref: MediaRef, resolution: MediaResolutionLevel): number {
  if (ref.kind === 'frames') return ref.frames.length * 260;
  const video = videoSeconds(ref);
  if (video > 0) return Math.round(video * VIDEO_TOKENS_PER_SECOND[resolution]);
  if (ref.kind !== 'public-video' && isAudioMimeType(ref.mimeType || '')) {
    return Math.round((ref.durationSeconds ?? 0) * AUDIO_TOKENS_PER_SECOND);
  }
  return 260;
}

function videoSeconds(ref: MediaRef): number {
  if (ref.kind === 'public-video') {
    return ref.window ? windowDurationSeconds(ref.window) : (ref.durationSeconds ?? 0);
  }
  if (ref.kind === 'remote' && isVideoMimeType(ref.mimeType || '')) {
    return ref.window ? windowDurationSeconds(ref.window) : (ref.durationSeconds ?? 0);
  }
  if (ref.kind === 'inline' && isVideoMimeType(ref.mimeType || '')) {
    return ref.durationSeconds ?? 0;
  }
  return 0;
}

function describeRef(ref: MediaRef): string {
  if (ref.kind === 'public-video') return ref.uri;
  if (ref.kind === 'remote') return ref.mimeType;
  if (ref.kind === 'frames') return `${ref.frames.length} cuadros`;
  return ref.mimeType;
}

function estimateBase64Bytes(base64: string): number {
  return Math.floor(base64.length * 0.75);
}
