import type { VisualBox } from './types';

/**
 * Letterbox: los detectores YOLO esperan una entrada cuadrada (p.ej. 640x640).
 * Para no deformar la captura se reescala manteniendo proporcion y se rellena
 * con barras (padding). Estas funciones PURAS calculan el reescalado y mapean
 * las cajas detectadas de vuelta a las coordenadas de la imagen original.
 */

export type Letterbox = {
  /** Factor de escala aplicado a la imagen original para caber en la entrada. */
  scale: number;
  /** Relleno horizontal (a cada lado) en pixeles de la imagen de entrada. */
  padX: number;
  /** Relleno vertical (arriba/abajo) en pixeles de la imagen de entrada. */
  padY: number;
  /** Ancho al que se reescalo la imagen original (sin padding). */
  resizedWidth: number;
  /** Alto al que se reescalo la imagen original (sin padding). */
  resizedHeight: number;
};

export function computeLetterbox(origWidth: number, origHeight: number, inputSize: number): Letterbox {
  const scale = Math.min(inputSize / origWidth, inputSize / origHeight);
  const resizedWidth = Math.round(origWidth * scale);
  const resizedHeight = Math.round(origHeight * scale);
  const padX = (inputSize - resizedWidth) / 2;
  const padY = (inputSize - resizedHeight) / 2;
  return { scale, padX, padY, resizedWidth, resizedHeight };
}

/** Mapea una caja en coordenadas de la entrada (con letterbox) a la imagen original. */
export function mapBoxToOriginal(box: VisualBox, letterbox: Letterbox): VisualBox {
  return {
    x0: (box.x0 - letterbox.padX) / letterbox.scale,
    y0: (box.y0 - letterbox.padY) / letterbox.scale,
    x1: (box.x1 - letterbox.padX) / letterbox.scale,
    y1: (box.y1 - letterbox.padY) / letterbox.scale,
    score: box.score,
  };
}

/** Recorta una caja a los limites [0..width]x[0..height] de la imagen original. */
export function clampBox(box: VisualBox, width: number, height: number): VisualBox {
  return {
    x0: Math.max(0, Math.min(width, box.x0)),
    y0: Math.max(0, Math.min(height, box.y0)),
    x1: Math.max(0, Math.min(width, box.x1)),
    y1: Math.max(0, Math.min(height, box.y1)),
    score: box.score,
  };
}
