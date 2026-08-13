// Nivel C: captura de la ventana marcada.
//
// La miniatura del selector (320x180) es barata y se genera para TODAS las
// ventanas a la vez; esta es una segunda peticion, acotada a la ventana elegida
// y a un tamano legible. Separarlas es lo que mantiene barato abrir el menu
// aunque el usuario tenga veinte ventanas abiertas.

import { DESKTOP_CONTEXT_LIMITS } from './types';

export interface CapturableSource {
  id: string;
  thumbnail: { isEmpty: () => boolean; toDataURL: () => string };
}

export type SourceReader = (options: {
  types: string[];
  thumbnailSize: { width: number; height: number };
}) => Promise<CapturableSource[]>;

/** Captura legible de una ventana concreta, o cadena vacia si ya no existe. */
export async function captureWindow(sourceId: string, getSources: SourceReader): Promise<string> {
  if (!sourceId) return '';
  try {
    const sources = await getSources({
      types: ['window'],
      thumbnailSize: {
        width: DESKTOP_CONTEXT_LIMITS.captureWidth,
        height: DESKTOP_CONTEXT_LIMITS.captureHeight,
      },
    });
    const source = sources.find((candidate) => candidate.id === sourceId);
    if (!source || source.thumbnail.isEmpty()) return '';
    return source.thumbnail.toDataURL();
  } catch (error) {
    console.warn('[ContextoEscritorio] No se pudo capturar la ventana:', toMessage(error));
    return '';
  }
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
