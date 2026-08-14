/**
 * Evaluacion de si una captura representa de verdad lo que el usuario ve.
 *
 * El compositor no entrega la superficie de contenido protegido por DRM y
 * devuelve una imagen uniforme, tipicamente negra. Enviar ese cuadro produce
 * exactamente la falla que la entrada de video existe para evitar: una
 * descripcion inventada de una escena no observada. La comprobacion ocurre en
 * main, antes de que la imagen salga del equipo.
 *
 * Se trabaja sobre el bitmap crudo en vez de re-codificar con `sharp`: la
 * captura ya esta en memoria como pixeles y el analisis no necesita un ciclo
 * de codificacion y decodificacion.
 */

export type CaptureQuality =
  | { usable: true }
  | { usable: false; reason: 'captura-vacia' | 'contenido-protegido'; detail: string };

/**
 * Desviacion tipica por canal por debajo de la cual la imagen no tiene
 * contenido discernible. Un valor bajo y no cero: una captura real, incluso de
 * una pagina casi blanca, conserva bordes de texto y controles.
 */
const UNIFORM_STDDEV_THRESHOLD = 3.5;
/** Muestras maximas del analisis; recorrer millones de pixeles no aporta. */
const MAX_SAMPLES = 4_000;

export interface CaptureBitmap {
  width: number;
  height: number;
  /** BGRA de 4 bytes por pixel, tal como lo entrega NativeImage. */
  bitmap: Uint8Array | Buffer;
}

export function evaluateCaptureQuality(input: CaptureBitmap | null): CaptureQuality {
  if (!input || input.width <= 0 || input.height <= 0 || !input.bitmap?.length) {
    return { usable: false, reason: 'captura-vacia', detail: 'La captura del navegador llego vacia.' };
  }

  const pixeles = Math.floor(input.bitmap.length / 4);
  if (pixeles <= 0) {
    return { usable: false, reason: 'captura-vacia', detail: 'La captura del navegador llego vacia.' };
  }

  const paso = Math.max(1, Math.floor(pixeles / MAX_SAMPLES));
  let muestras = 0;
  const sumas = [0, 0, 0];
  const sumasCuadrado = [0, 0, 0];

  for (let indice = 0; indice < pixeles; indice += paso) {
    const base = indice * 4;
    for (let canal = 0; canal < 3; canal += 1) {
      const valor = input.bitmap[base + canal];
      sumas[canal] += valor;
      sumasCuadrado[canal] += valor * valor;
    }
    muestras += 1;
  }

  if (muestras === 0) {
    return { usable: false, reason: 'captura-vacia', detail: 'La captura del navegador llego vacia.' };
  }

  let maxDesviacion = 0;
  for (let canal = 0; canal < 3; canal += 1) {
    const media = sumas[canal] / muestras;
    const varianza = Math.max(0, sumasCuadrado[canal] / muestras - media * media);
    maxDesviacion = Math.max(maxDesviacion, Math.sqrt(varianza));
  }

  if (maxDesviacion < UNIFORM_STDDEV_THRESHOLD) {
    return {
      usable: false,
      reason: 'contenido-protegido',
      detail: 'La captura no tiene contenido discernible. Suele ocurrir con reproduccion protegida (DRM), que el compositor no entrega.',
    };
  }

  return { usable: true };
}
