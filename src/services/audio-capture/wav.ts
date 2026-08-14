/**
 * Encapsulado WAV de PCM mono 16 kHz.
 *
 * Se elige WAV frente a un contenedor comprimido porque evita añadir un
 * codificador al renderer: un minuto de audio mono a 16 kHz son ~1,9 MB, muy
 * por debajo del presupuesto de datos incrustados, y el proveedor remuestrea de
 * todos modos.
 */

export const AMBIENT_SAMPLE_RATE = 16_000;
const WAV_HEADER_BYTES = 44;

export function encodePcm16ToWav(samples: Int16Array, sampleRate = AMBIENT_SAMPLE_RATE): Uint8Array {
  const bytesPorMuestra = 2;
  const datos = samples.length * bytesPorMuestra;
  const buffer = new ArrayBuffer(WAV_HEADER_BYTES + datos);
  const vista = new DataView(buffer);

  escribirTexto(vista, 0, 'RIFF');
  vista.setUint32(4, 36 + datos, true);
  escribirTexto(vista, 8, 'WAVE');
  escribirTexto(vista, 12, 'fmt ');
  vista.setUint32(16, 16, true); // tamaño del bloque fmt
  vista.setUint16(20, 1, true); // PCM entero
  vista.setUint16(22, 1, true); // mono
  vista.setUint32(24, sampleRate, true);
  vista.setUint32(28, sampleRate * bytesPorMuestra, true); // bytes por segundo
  vista.setUint16(32, bytesPorMuestra, true); // alineacion de bloque
  vista.setUint16(34, 16, true); // bits por muestra
  escribirTexto(vista, 36, 'data');
  vista.setUint32(40, datos, true);

  new Int16Array(buffer, WAV_HEADER_BYTES).set(samples);
  return new Uint8Array(buffer);
}

/** Convierte muestras en coma flotante (-1..1) a PCM entero de 16 bits. */
export function floatToPcm16(samples: Float32Array): Int16Array {
  const pcm = new Int16Array(samples.length);
  for (let indice = 0; indice < samples.length; indice += 1) {
    const acotada = Math.max(-1, Math.min(1, samples[indice]));
    pcm[indice] = Math.round(acotada * 32767);
  }
  return pcm;
}

export function toBase64(bytes: Uint8Array): string {
  let binario = '';
  const PASO = 0x8000; // String.fromCharCode revienta con arrays enormes
  for (let indice = 0; indice < bytes.length; indice += PASO) {
    binario += String.fromCharCode(...bytes.subarray(indice, indice + PASO));
  }
  return btoa(binario);
}

export function wavDurationSeconds(sampleCount: number, sampleRate = AMBIENT_SAMPLE_RATE): number {
  return sampleRate > 0 ? sampleCount / sampleRate : 0;
}

function escribirTexto(vista: DataView, offset: number, texto: string): void {
  for (let indice = 0; indice < texto.length; indice += 1) {
    vista.setUint8(offset + indice, texto.charCodeAt(indice));
  }
}
