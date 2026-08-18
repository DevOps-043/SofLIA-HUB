import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BrowserDomControl, BrowserDomSnapshot } from '../integrated-browser/types';

const applySoMOverlay = vi.fn<typeof import('../desktop-agent/screenshot-overlays').applySoMOverlay>(async () => 'IMAGEN-MARCADA');
vi.mock('../desktop-agent/screenshot-overlays', () => ({ applySoMOverlay }));
vi.mock('../desktop-agent/sharp', () => ({ loadSharp: () => ({}) }));

const { browserMarksEnabled, markCapture } = await import('../integrated-browser/cu-driver');

const VIEWPORT = { width: 1600, height: 1200 };
const IMAGEN_LIMPIA = 'IMAGEN-LIMPIA';

function control(ref: string, y: number): BrowserDomControl {
  return {
    ref, tag: 'button', role: '', name: `Control ${ref}`, text: '', type: '', href: '',
    disabled: false, checked: null, rect: { x: 40, y, width: 120, height: 32 }, scope: 'document',
  };
}

function dom(controls: BrowserDomControl[]): BrowserDomSnapshot {
  return {
    title: 'Panel', url: 'https://example.com', language: 'es', text: '', headings: [], landmarks: [],
    controls, images: [], frames: [],
    viewport: { width: 1600, height: 1200, scrollX: 0, scrollY: 0, documentWidth: 1600, documentHeight: 4000 },
    truncated: false,
  };
}

describe('marcas en la captura de Computer Use', () => {
  const original = process.env.SOFLIA_BROWSER_SOM;

  beforeEach(() => { vi.clearAllMocks(); process.env.SOFLIA_BROWSER_SOM = '1'; });
  afterEach(() => {
    if (original === undefined) delete process.env.SOFLIA_BROWSER_SOM;
    else process.env.SOFLIA_BROWSER_SOM = original;
  });

  it('esta apagado por omision, para poder medir con el mismo binario', () => {
    delete process.env.SOFLIA_BROWSER_SOM;
    expect(browserMarksEnabled()).toBe(false);
    process.env.SOFLIA_BROWSER_SOM = '1';
    expect(browserMarksEnabled()).toBe(true);
  });

  it('devuelve la captura intacta con el flag apagado', async () => {
    delete process.env.SOFLIA_BROWSER_SOM;

    const resultado = await markCapture(IMAGEN_LIMPIA, dom([control('a', 10), control('b', 60), control('c', 110)]), VIEWPORT);

    expect(resultado).toEqual({ base64: IMAGEN_LIMPIA, marks: [] });
    expect(applySoMOverlay).not.toHaveBeenCalled();
  });

  it('dibuja las marcas y devuelve una imagen distinta de la original', async () => {
    const observacion = dom([control('a', 10), control('b', 60), control('c', 110)]);

    const resultado = await markCapture(IMAGEN_LIMPIA, observacion, VIEWPORT);

    expect(resultado.base64).toBe('IMAGEN-MARCADA');
    expect(resultado.marks.map((mark) => mark.ref)).toEqual(['a', 'b', 'c']);
    // La observacion que recibio no se toca: esa misma imagen alimenta el
    // respaldo visual del renderer y los adjuntos del chat.
    expect(observacion.controls).toHaveLength(3);
    expect(IMAGEN_LIMPIA).toBe('IMAGEN-LIMPIA');
  });

  it('traduce el rectangulo del viewport a los pixeles de la captura reducida', async () => {
    await markCapture(IMAGEN_LIMPIA, dom([control('a', 10), control('b', 60), control('c', 110)]), VIEWPORT);

    const mapRect = applySoMOverlay.mock.calls[0]?.[0]?.mapRect as
      (rect: { x: number; y: number; width: number; height: number }, imagen: { width: number; height: number }) => unknown;
    // Viewport 1600x1200 contra una captura reducida a 1024x768: factor 0.64.
    expect(mapRect({ x: 400, y: 300, width: 200, height: 50 }, { width: 1024, height: 768 }))
      .toEqual({ x: 256, y: 192, width: 128, height: 32 });
  });

  it('no marca cuando hay menos de tres controles', async () => {
    const resultado = await markCapture(IMAGEN_LIMPIA, dom([control('a', 10), control('b', 60)]), VIEWPORT);

    // Con dos cajas el numero no desambigua nada y solo tapa contenido.
    expect(resultado).toEqual({ base64: IMAGEN_LIMPIA, marks: [] });
    expect(applySoMOverlay).not.toHaveBeenCalled();
  });

  it('devuelve la captura limpia si el dibujado falla', async () => {
    applySoMOverlay.mockRejectedValueOnce(new Error('sharp exploto'));

    const resultado = await markCapture(IMAGEN_LIMPIA, dom([control('a', 10), control('b', 60), control('c', 110)]), VIEWPORT);

    // Una imagen sin marcar es peor que una marcada, pero mucho mejor que un
    // paso de Computer Use perdido.
    expect(resultado).toEqual({ base64: IMAGEN_LIMPIA, marks: [] });
  });
});
