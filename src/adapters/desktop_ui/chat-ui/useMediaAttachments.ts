import { useCallback, useRef, useState } from 'react';
import {
  cancelMediaUpload,
  grantMediaUploadConsent,
  hasMediaUploadConsent,
  isMediaUploadAvailable,
  releaseMediaUpload,
  uploadMedia,
  MEDIA_UPLOAD_CONSENT_MESSAGE,
} from '../../../services/media-input-service';
import {
  evaluateCandidate,
  evaluateCombinedDuration,
  isReadyToSend,
  type AttachmentRejection,
  type MediaAttachment,
} from '../../../services/media-attachments';
import type { MediaRef } from '../../../shared/multimodal-input';

/**
 * Adjuntos de medio del compositor.
 *
 * Un archivo grande no se lee en el renderer: se resuelve su ruta en disco y
 * main lo sube por flujo. Los pequeños siguen viajando incrustados, que es la
 * ruta que ya existia para las imagenes.
 */
export function useMediaAttachments(input: {
  /** Pide confirmacion al usuario; devuelve si acepto enviar el archivo. */
  requestConsent: (message: string) => Promise<boolean>;
  onRejection: (rejection: AttachmentRejection) => void;
}) {
  const [attachments, setAttachments] = useState<MediaAttachment[]>([]);
  const secuencia = useRef(0);

  const actualizar = useCallback((id: string, cambios: Partial<MediaAttachment>) => {
    setAttachments((actuales) => actuales.map((item) => (item.id === id ? { ...item, ...cambios } : item)));
  }, []);

  const subir = useCallback(async (adjunto: MediaAttachment) => {
    if (!adjunto.path) {
      actualizar(adjunto.id, { state: 'fallido', error: 'No pude resolver la ubicacion del archivo.' });
      return;
    }
    actualizar(adjunto.id, { state: 'subiendo', error: undefined });
    try {
      const registro = await uploadMedia({ path: adjunto.path, mimeType: adjunto.mimeType });
      if (registro.state === 'ready' && registro.uri) {
        actualizar(adjunto.id, { state: 'listo', uploadId: registro.uploadId, uri: registro.uri, expiresAt: registro.expiresAt });
        return;
      }
      if (registro.state === 'cancelled') return;
      actualizar(adjunto.id, { state: 'fallido', uploadId: registro.uploadId, error: registro.error || 'No pude preparar el archivo.' });
    } catch (error) {
      actualizar(adjunto.id, { state: 'fallido', error: error instanceof Error ? error.message : 'No pude preparar el archivo.' });
    }
  }, [actualizar]);

  const add = useCallback(async (files: Array<{ file: File; path: string }>) => {
    for (const { file, path } of files) {
      const candidato = { name: file.name, mimeType: file.type, sizeBytes: file.size };
      const veredicto = evaluateCandidate(candidato, attachments);
      if (!veredicto.accepted) {
        input.onRejection(veredicto.rejection);
        continue;
      }

      const id = `adjunto-${++secuencia.current}`;
      const base: MediaAttachment = {
        id, name: file.name, mimeType: file.type, sizeBytes: file.size, state: 'pendiente',
      };

      if (veredicto.transport === 'inline') {
        const dataUrl = await readAsDataUrl(file);
        setAttachments((actuales) => [...actuales, { ...base, state: 'listo', dataUrl }]);
        continue;
      }

      if (!isMediaUploadAvailable()) {
        input.onRejection({
          name: file.name,
          reason: 'excede-limite-proveedor',
          detail: 'Este archivo necesita subirse para analizarse y esa capacidad no esta disponible aqui.',
        });
        continue;
      }
      // La salida de datos se consulta una vez por sesion, antes de la primera
      // transferencia: el archivo deja el equipo.
      if (!hasMediaUploadConsent()) {
        const autorizado = await input.requestConsent(MEDIA_UPLOAD_CONSENT_MESSAGE);
        if (!autorizado) continue;
        grantMediaUploadConsent();
      }

      const adjunto: MediaAttachment = { ...base, path, state: 'procesando' };
      setAttachments((actuales) => [...actuales, adjunto]);
      void subir(adjunto);
    }
  }, [attachments, input, subir]);

  const remove = useCallback(async (id: string) => {
    const adjunto = attachments.find((item) => item.id === id);
    setAttachments((actuales) => actuales.filter((item) => item.id !== id));
    if (!adjunto?.uploadId) return;
    // Cancelar lo que siga en vuelo y soltar el archivo remoto si ya existia.
    if (adjunto.state === 'subiendo' || adjunto.state === 'procesando') await cancelMediaUpload(adjunto.uploadId);
    else if (adjunto.state === 'listo') await releaseMediaUpload(adjunto.uploadId);
  }, [attachments]);

  const retry = useCallback((id: string) => {
    const adjunto = attachments.find((item) => item.id === id);
    if (adjunto?.state === 'fallido') void subir(adjunto);
  }, [attachments, subir]);

  /** Libera todo lo subido al resolverse o cancelarse el turno. */
  const clear = useCallback(async () => {
    const pendientes = attachments;
    setAttachments([]);
    await Promise.all(pendientes.map(async (item) => {
      if (!item.uploadId) return;
      if (item.state === 'subiendo' || item.state === 'procesando') await cancelMediaUpload(item.uploadId);
      else if (item.state === 'listo') await releaseMediaUpload(item.uploadId);
    }));
  }, [attachments]);

  /** Medios del turno, ya sin los que fallaron. */
  const toMediaRefs = useCallback((): MediaRef[] => attachments.flatMap((item): MediaRef[] => {
    if (item.state !== 'listo') return [];
    if (item.uri) {
      return [{ kind: 'remote', mimeType: item.mimeType, uri: item.uri, expiresAt: item.expiresAt, durationSeconds: item.durationSeconds }];
    }
    if (!item.dataUrl) return [];
    const separador = item.dataUrl.indexOf(',');
    if (separador === -1) return [];
    return [{ kind: 'inline', mimeType: item.mimeType, base64: item.dataUrl.slice(separador + 1), durationSeconds: item.durationSeconds }];
  }), [attachments]);

  const durationRejection = evaluateCombinedDuration(attachments);

  return {
    attachments,
    add,
    remove,
    retry,
    clear,
    toMediaRefs,
    canSend: isReadyToSend(attachments) && !durationRejection,
    durationRejection,
  };
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
}
