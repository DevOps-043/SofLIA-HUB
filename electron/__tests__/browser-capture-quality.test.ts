import { describe, expect, it } from 'vitest';
import { evaluateCaptureQuality } from '../integrated-browser/capture-quality';
import { resolvePublicVideoUrl } from '../integrated-browser/player-state';

/** Bitmap BGRA uniforme del color indicado. */
function bitmapUniforme(width: number, height: number, valor: number): Uint8Array {
  const bitmap = new Uint8Array(width * height * 4);
  bitmap.fill(valor);
  return bitmap;
}

/** Bitmap BGRA con contenido: alterna claro y oscuro por pixel. */
function bitmapConContenido(width: number, height: number): Uint8Array {
  const bitmap = new Uint8Array(width * height * 4);
  for (let indice = 0; indice < width * height; indice += 1) {
    const valor = indice % 2 === 0 ? 20 : 235;
    bitmap[indice * 4] = valor;
    bitmap[indice * 4 + 1] = valor;
    bitmap[indice * 4 + 2] = valor;
    bitmap[indice * 4 + 3] = 255;
  }
  return bitmap;
}

describe('calidad de la captura del navegador', () => {
  it('CAPT-001: una captura con contenido es utilizable', () => {
    expect(evaluateCaptureQuality({ width: 80, height: 60, bitmap: bitmapConContenido(80, 60) }))
      .toEqual({ usable: true });
  });

  it('CAPT-002: un cuadro completamente negro se clasifica como contenido protegido', () => {
    const resultado = evaluateCaptureQuality({ width: 80, height: 60, bitmap: bitmapUniforme(80, 60, 0) });

    expect(resultado.usable).toBe(false);
    if (!resultado.usable) {
      expect(resultado.reason).toBe('contenido-protegido');
      expect(resultado.detail).toContain('DRM');
    }
  });

  it('CAPT-003: un cuadro uniforme no negro tambien se rechaza', () => {
    // Un blanco plano tampoco es evidencia: no distingue una pagina en blanco
    // de una superficie que el compositor no entrego.
    const resultado = evaluateCaptureQuality({ width: 80, height: 60, bitmap: bitmapUniforme(80, 60, 255) });

    expect(resultado.usable).toBe(false);
  });

  it('CAPT-004: una captura vacia se declara como tal', () => {
    expect(evaluateCaptureQuality(null)).toMatchObject({ usable: false, reason: 'captura-vacia' });
    expect(evaluateCaptureQuality({ width: 0, height: 0, bitmap: new Uint8Array() }))
      .toMatchObject({ usable: false, reason: 'captura-vacia' });
  });
});

describe('resolucion del video publico de la pagina', () => {
  it('VIDEO-URL-001: reconoce las formas publicas de YouTube y las normaliza', () => {
    expect(resolvePublicVideoUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30'))
      .toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(resolvePublicVideoUrl('https://youtu.be/dQw4w9WgXcQ'))
      .toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(resolvePublicVideoUrl('https://www.youtube.com/shorts/dQw4w9WgXcQ'))
      .toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(resolvePublicVideoUrl('https://www.youtube.com/embed/dQw4w9WgXcQ'))
      .toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  });

  it('VIDEO-URL-002: un destino no direccionable no produce ruta de video publico', () => {
    expect(resolvePublicVideoUrl('https://intranet.empresa.test/curso/leccion-3')).toBeNull();
    expect(resolvePublicVideoUrl('https://www.youtube.com/feed/subscriptions')).toBeNull();
    expect(resolvePublicVideoUrl('file:///C:/videos/demo.mp4')).toBeNull();
    expect(resolvePublicVideoUrl('')).toBeNull();
    expect(resolvePublicVideoUrl(null)).toBeNull();
  });

  it('VIDEO-URL-003: un identificador con forma invalida se descarta', () => {
    expect(resolvePublicVideoUrl('https://www.youtube.com/watch?v=../../etc/passwd')).toBeNull();
    expect(resolvePublicVideoUrl('https://www.youtube.com/watch?v=abc')).toBeNull();
  });
});
