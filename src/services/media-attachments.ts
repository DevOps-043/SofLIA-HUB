import {
  MEDIA_BUDGET,
  isAudioMimeType,
  isImageMimeType,
  isSupportedMediaMimeType,
  isVideoMimeType,
} from '../shared/multimodal-input';

/**
 * Logica de los adjuntos de medio del compositor, separada de React para que
 * los limites y los rechazos sean verificables sin montar la interfaz.
 */

export type MediaAttachmentState = 'pendiente' | 'subiendo' | 'procesando' | 'listo' | 'fallido';

export interface MediaAttachment {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  state: MediaAttachmentState;
  /** Ruta local; solo para los que se suben, nunca viaja al modelo. */
  path?: string;
  /** Data URL para los que viajan incrustados. */
  dataUrl?: string;
  /** Identificador de la subida en curso, para consultarla o cancelarla. */
  uploadId?: string;
  uri?: string;
  expiresAt?: string;
  durationSeconds?: number;
  error?: string;
}

export type AttachmentRejection = {
  name: string;
  reason: 'formato-no-admitido' | 'excede-limite-proveedor' | 'limite-de-adjuntos' | 'duracion-total';
  detail: string;
};

/** ¿El archivo viaja incrustado en la peticion o hay que subirlo antes? */
export function resolveTransport(mimeType: string, sizeBytes: number): 'inline' | 'upload' {
  // Las imagenes siempre caben incrustadas y no justifican una subida remota.
  if (isImageMimeType(mimeType)) return 'inline';
  return sizeBytes > MEDIA_BUDGET.maxInlineBytes ? 'upload' : 'inline';
}

export interface CandidateFile {
  name: string;
  mimeType: string;
  sizeBytes: number;
}

/**
 * Decide si un archivo puede aceptarse, dado lo que ya hay en el turno.
 *
 * Devuelve el motivo concreto en vez de un booleano: el compositor tiene que
 * poder decirle al usuario el formato recibido, el limite aplicable o la
 * duracion que sobra, no un "no se puede" opaco.
 */
export function evaluateCandidate(
  file: CandidateFile,
  current: MediaAttachment[],
): { accepted: true; transport: 'inline' | 'upload' } | { accepted: false; rejection: AttachmentRejection } {
  const mimeType = (file.mimeType || '').toLowerCase();

  if (!isSupportedMediaMimeType(mimeType)) {
    return {
      accepted: false,
      rejection: {
        name: file.name,
        reason: 'formato-no-admitido',
        detail: `No puedo analizar archivos ${mimeType || 'de tipo desconocido'}. Formatos admitidos: ${describeSupported()}.`,
      },
    };
  }

  if (file.sizeBytes > MEDIA_BUDGET.maxUploadBytes) {
    return {
      accepted: false,
      rejection: {
        name: file.name,
        reason: 'excede-limite-proveedor',
        detail: `El archivo pesa ${formatBytes(file.sizeBytes)} y el limite es ${formatBytes(MEDIA_BUDGET.maxUploadBytes)}. Recorta el fragmento que te interesa.`,
      },
    };
  }

  if (current.length >= MEDIA_BUDGET.maxMediaPerTurn) {
    return {
      accepted: false,
      rejection: {
        name: file.name,
        reason: 'limite-de-adjuntos',
        detail: `Puedo analizar hasta ${MEDIA_BUDGET.maxMediaPerTurn} archivos por mensaje. Envia el resto en otro mensaje.`,
      },
    };
  }

  return { accepted: true, transport: resolveTransport(mimeType, file.sizeBytes) };
}

/** ¿La duracion combinada de los adjuntos supera el maximo del turno? */
export function evaluateCombinedDuration(attachments: MediaAttachment[]): AttachmentRejection | null {
  const total = attachments.reduce((suma, item) => suma + (item.durationSeconds ?? 0), 0);
  if (total <= MEDIA_BUDGET.maxCombinedDurationSeconds) return null;
  return {
    name: 'adjuntos del mensaje',
    reason: 'duracion-total',
    detail: `La duracion combinada es de ${Math.round(total / 60)} minutos y el maximo por mensaje es de ${Math.round(MEDIA_BUDGET.maxCombinedDurationSeconds / 60)}. Acota un fragmento antes de enviar.`,
  };
}

/** ¿Puede enviarse el turno, o hay adjuntos que todavia no estan listos? */
export function isReadyToSend(attachments: MediaAttachment[]): boolean {
  return attachments.every((item) => item.state === 'listo' || item.state === 'fallido');
}

export function describeSupported(): string {
  return 'imagen (PNG, JPEG, WebP), video (MP4, WebM, MOV) y audio (WAV, MP3, AAC, OGG, FLAC)';
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${Math.round(bytes / 1024 ** 2)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function classifyMedia(mimeType: string): 'imagen' | 'video' | 'audio' | 'otro' {
  if (isImageMimeType(mimeType)) return 'imagen';
  if (isVideoMimeType(mimeType)) return 'video';
  if (isAudioMimeType(mimeType)) return 'audio';
  return 'otro';
}
