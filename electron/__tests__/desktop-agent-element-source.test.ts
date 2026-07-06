import { describe, expect, it, vi } from 'vitest';
import {
  createCompositeElementSource,
  createOcrElementSource,
  createUiaElementSource,
  fuseDetectedElements,
  iou,
  detectedToUIElement,
  type DetectedElement,
  type ElementSourceProvider,
} from '../desktop-agent/element-source';
import type { CompositeScreenshot } from '../desktop-agent/screenshot-capture';
import type { ScreenshotLayout } from '../desktop-agent/types';
import type { WorkerElement, WorkerResponse } from '../desktop-agent/native-worker/worker-protocol';

function rect(x: number, y: number, w: number, h: number) {
  return { x, y, width: w, height: h };
}

function detected(
  fuente: DetectedElement['fuente'],
  x: number,
  y: number,
  w = 80,
  h = 30,
  extra: Partial<DetectedElement> = {},
): DetectedElement {
  return { bboxFisico: rect(x, y, w, h), controlType: 'Button', fuente, confianza: 1, ...extra };
}

/** Captura mínima; los proveedores fake la ignoran. */
const capturaVacia = { base64: 'x', layout: null, actualWidth: 100, actualHeight: 100 } as unknown as CompositeScreenshot;

function fakeProvider(fuente: DetectedElement['fuente'], elementos: DetectedElement[], disponible = true): ElementSourceProvider {
  return {
    fuente,
    disponible: () => disponible,
    detectar: vi.fn(async () => elementos),
  };
}

describe('IoU de rectángulos', () => {
  it('ES-001: cajas idénticas dan 1', () => {
    expect(iou(rect(0, 0, 100, 100), rect(0, 0, 100, 100))).toBe(1);
  });
  it('ES-002: cajas disjuntas dan 0', () => {
    expect(iou(rect(0, 0, 10, 10), rect(100, 100, 10, 10))).toBe(0);
  });
  it('ES-003: solapamiento parcial es proporción intersección/unión', () => {
    // Dos 10x10 solapadas en un cuadrante 5x5: inter=25, union=175.
    expect(iou(rect(0, 0, 10, 10), rect(5, 5, 10, 10))).toBeCloseTo(25 / 175, 5);
  });
});

describe('Fusión de detecciones', () => {
  it('ES-010: ante solapamiento gana la fuente de mayor prioridad (UIA > OCR > visual)', () => {
    const uia = detected('uia', 100, 100, 80, 30, { name: 'Jugar' });
    const ocr = detected('ocr', 102, 101, 80, 30, { name: 'JUGAR', confianza: 0.9 }); // solapa con uia
    const visual = detected('visual', 500, 500, 40, 40); // separado

    const fusionados = fuseDetectedElements([[ocr], [uia], [visual]], 0.6, 60);

    // El solapado UIA sobrevive; el OCR duplicado se descarta; el visual separado queda.
    expect(fusionados).toHaveLength(2);
    const fuentes = fusionados.map((element) => element.fuente).sort();
    expect(fuentes).toEqual(['uia', 'visual']);
  });

  it('ES-011: numeración estable de arriba a abajo, luego izquierda a derecha', () => {
    const abajo = detected('uia', 50, 400);
    const arribaDerecha = detected('uia', 300, 40);
    const arribaIzquierda = detected('uia', 20, 40);

    const fusionados = fuseDetectedElements([[abajo, arribaDerecha, arribaIzquierda]], 0.6, 60);

    expect(fusionados.map((element) => element.bboxFisico.x)).toEqual([20, 300, 50]);
  });

  it('ES-012: respeta el tope maxDetectedElements conservando las más confiables', () => {
    const muchos = Array.from({ length: 100 }, (_, i) => detected('ocr', i * 10, i * 10, 8, 8, { confianza: i / 100 }));
    const fusionados = fuseDetectedElements([muchos], 0.6, 10);
    expect(fusionados).toHaveLength(10);
  });

  it('ES-013: descarta cajas de área nula', () => {
    const bueno = detected('uia', 10, 10);
    const degenerado = detected('uia', 50, 50, 0, 20);
    const fusionados = fuseDetectedElements([[bueno, degenerado]], 0.6, 60);
    expect(fusionados).toHaveLength(1);
  });
});

describe('Composite: orquestación de fuentes', () => {
  it('ES-020: con UIA suficiente NO consulta OCR (ahorro de latencia)', async () => {
    const uiaElems = Array.from({ length: 15 }, (_, i) => detected('uia', i * 30, 10, 20, 20));
    const uia = fakeProvider('uia', uiaElems);
    const ocr = fakeProvider('ocr', [detected('ocr', 400, 400)]);
    const source = createCompositeElementSource({
      providers: [uia, ocr],
      capturar: async () => capturaVacia,
      maxDetectedElements: 60,
      dedupIouThreshold: 0.6,
      sufficientPriorityElements: 12,
      visualSkipWhenUiaRich: 40,
    });

    const elementos = await source.obtenerElementos(capturaVacia);

    expect(uia.detectar).toHaveBeenCalledTimes(1);
    expect(ocr.detectar).not.toHaveBeenCalled();
    expect(elementos).toHaveLength(15);
    expect(elementos[0].id).toBe(1);
  });

  it('ES-020b: con UIA MUY rica (Word/IDE) se omite el visual (ONNX caro) para ahorrar latencia', async () => {
    const uiaElems = Array.from({ length: 50 }, (_, i) => detected('uia', i * 10, 10, 8, 8));
    const uia = fakeProvider('uia', uiaElems);
    const visual = fakeProvider('visual', [detected('visual', 400, 400)]);
    const source = createCompositeElementSource({
      providers: [uia, visual],
      capturar: async () => capturaVacia,
      maxDetectedElements: 60,
      dedupIouThreshold: 0.6,
      sufficientPriorityElements: 12,
      visualSkipWhenUiaRich: 40,
    });

    await source.obtenerElementos(capturaVacia);

    expect(uia.detectar).toHaveBeenCalledTimes(1);
    expect(visual.detectar).not.toHaveBeenCalled(); // UIA 50 >= 40 -> visual omitido
  });

  it('ES-020c: con UIA escasa (app opaca) el visual SÍ corre', async () => {
    const uia = fakeProvider('uia', [detected('uia', 10, 10)]);
    const visual = fakeProvider('visual', [detected('visual', 400, 400)]);
    const source = createCompositeElementSource({
      providers: [uia, visual],
      capturar: async () => capturaVacia,
      maxDetectedElements: 60,
      dedupIouThreshold: 0.6,
      sufficientPriorityElements: 12,
      visualSkipWhenUiaRich: 40,
    });

    await source.obtenerElementos(capturaVacia);
    expect(visual.detectar).toHaveBeenCalledTimes(1); // UIA 1 < 40 -> visual corre
  });

  it('ES-021: con UIA insuficiente (app opaca) sí consulta OCR y fusiona', async () => {
    const uia = fakeProvider('uia', [detected('uia', 10, 10)]);
    const ocr = fakeProvider('ocr', [detected('ocr', 200, 200, 80, 30, { name: 'MINECRAFT' })]);
    const source = createCompositeElementSource({
      providers: [uia, ocr],
      capturar: async () => capturaVacia,
      maxDetectedElements: 60,
      dedupIouThreshold: 0.6,
      sufficientPriorityElements: 12,
      visualSkipWhenUiaRich: 40,
    });

    const elementos = await source.obtenerElementos(capturaVacia);

    expect(ocr.detectar).toHaveBeenCalledTimes(1);
    expect(elementos).toHaveLength(2);
    expect(elementos.map((element) => element.name)).toContain('MINECRAFT');
  });

  it('ES-022: una fuente que falla no rompe la fusión', async () => {
    const uia: ElementSourceProvider = {
      fuente: 'uia',
      disponible: () => true,
      detectar: vi.fn(async () => { throw new Error('worker caido'); }),
    };
    const ocr = fakeProvider('ocr', [detected('ocr', 200, 200)]);
    const source = createCompositeElementSource({
      providers: [uia, ocr],
      capturar: async () => capturaVacia,
      maxDetectedElements: 60,
      dedupIouThreshold: 0.6,
      sufficientPriorityElements: 12,
      visualSkipWhenUiaRich: 40,
    });

    const elementos = await source.obtenerElementos(capturaVacia);
    expect(elementos).toHaveLength(1);
    expect(elementos[0].name).toBe('');
    expect(elementos[0].controlType).toBe('Button');
  });

  it('ES-023: fuente no disponible se omite; usa capturar() cuando no se pasa captura', async () => {
    const capturar = vi.fn(async () => capturaVacia);
    const uia = fakeProvider('uia', [], false); // no disponible (otra plataforma)
    const ocr = fakeProvider('ocr', [detected('ocr', 10, 10)]);
    const source = createCompositeElementSource({
      providers: [uia, ocr],
      capturar,
      maxDetectedElements: 60,
      dedupIouThreshold: 0.6,
      sufficientPriorityElements: 12,
      visualSkipWhenUiaRich: 40,
    });

    const elementos = await source.obtenerElementos();

    expect(capturar).toHaveBeenCalledTimes(1);
    expect(uia.detectar).not.toHaveBeenCalled();
    expect(elementos).toHaveLength(1);
  });
});

describe('Visual provider fusion', () => {
  it('ES-024: agrega detecciones visuales al Set-of-Marks aunque UIA sea suficiente', async () => {
    const uiaElems = Array.from({ length: 15 }, (_, i) => detected('uia', i * 30, 10, 20, 20));
    const uia = fakeProvider('uia', uiaElems);
    const ocr = fakeProvider('ocr', [detected('ocr', 400, 400)]);
    const visual = fakeProvider('visual', [detected('visual', 600, 600, 90, 35, { controlType: 'icon', confianza: 0.8 })]);
    const source = createCompositeElementSource({
      providers: [uia, ocr, visual],
      capturar: async () => capturaVacia,
      maxDetectedElements: 60,
      dedupIouThreshold: 0.6,
      sufficientPriorityElements: 12,
      visualSkipWhenUiaRich: 40,
    });

    const elementos = await source.obtenerElementos(capturaVacia);

    expect(ocr.detectar).not.toHaveBeenCalled();
    expect(visual.detectar).toHaveBeenCalledTimes(1);
    expect(elementos.some((element) => element.controlType === 'icon')).toBe(true);
  });
});

describe('detectedToUIElement', () => {
  it('ES-030: mapea bbox físico a boundingRect y conserva nombre/tipo', () => {
    const ui = detectedToUIElement(detected('ocr', 5, 6, 70, 20, { name: 'Aceptar', controlType: 'Text' }), 7);
    expect(ui).toEqual({
      id: 7,
      name: 'Aceptar',
      controlType: 'Text',
      boundingRect: { x: 5, y: 6, width: 70, height: 20 },
      isEnabled: true,
      value: '',
    });
  });
});

describe('Fuente UIA (worker listElements)', () => {
  function fakeWorker(elements: WorkerElement[], scanned = elements.length) {
    return {
      send: vi.fn(async (): Promise<WorkerResponse> => ({ id: 1, ok: true, cmd: 'listElements', elements, scanned })),
    } as any;
  }

  it('ES-040: pide listElements con despertar de accesibilidad y mapea a físico', async () => {
    const worker = fakeWorker([
      { name: 'Jugar', controlType: 'Button', rect: rect(600, 600, 80, 30), clickX: 640, clickY: 615 },
    ]);
    const source = createUiaElementSource({ worker, sparseThreshold: 8, wakeDelayMs: 1200, maxElements: 100 });

    const detectados = await source.detectar(capturaVacia);

    expect(worker.send).toHaveBeenCalledWith(
      expect.objectContaining({ cmd: 'listElements', sparseThreshold: 8, wakeDelayMs: 1200, maxElements: 100 }),
    );
    expect(detectados).toHaveLength(1);
    expect(detectados[0]).toMatchObject({ name: 'Jugar', controlType: 'Button', fuente: 'uia', bboxFisico: rect(600, 600, 80, 30) });
  });

  it('ES-041: descarta rects de área nula', async () => {
    const worker = fakeWorker([
      { name: 'Bueno', controlType: 'Button', rect: rect(10, 10, 40, 20), clickX: 30, clickY: 20 },
      { name: 'Degenerado', controlType: 'Text', rect: rect(0, 0, 0, 0), clickX: 0, clickY: 0 },
    ]);
    const source = createUiaElementSource({ worker });
    const detectados = await source.detectar(capturaVacia);
    expect(detectados).toHaveLength(1);
    expect(detectados[0].name).toBe('Bueno');
  });

  it('ES-042: solo disponible en Windows', () => {
    const source = createUiaElementSource({ worker: fakeWorker([]) });
    expect(source.disponible()).toBe(process.platform === 'win32');
  });
});

describe('Fuente OCR (líneas → elementos)', () => {
  const layout: ScreenshotLayout = {
    screenshotWidth: 1024,
    screenshotHeight: 768,
    offsetX: 0,
    offsetY: 96,
    renderScale: 0.5333,
    virtualBounds: { x: 0, y: 0, width: 1920, height: 1080 },
    displayRegions: [{ displayId: '1', bounds: { x: 0, y: 0, width: 1920, height: 1080 }, left: 0, top: 96, width: 1024, height: 576 }],
  };

  const captura = { base64: 'img', layout, actualWidth: 1024, actualHeight: 768 } as CompositeScreenshot;

  function buildProvider() {
    return createOcrElementSource({
      reconocerTextos: async () => ({
        lineas: [
          { texto: 'MINECRAFT: JAVA EDITION', confianza: 0.9, bbox: { x0: 240, y0: 340, x1: 400, y1: 360 } },
          { texto: 'ruido', confianza: 0.1, bbox: { x0: 0, y0: 0, x1: 5, y1: 5 } },
        ],
        palabras: [],
      }),
      // imagen -> DIP (monitor a 100%, DIP == físico)
      mapImagenADip: (x, y, capturaLayout) => {
        if (!capturaLayout) return null;
        return {
          x: capturaLayout.virtualBounds.x + (x - capturaLayout.offsetX) / capturaLayout.renderScale,
          y: capturaLayout.virtualBounds.y + (y - capturaLayout.offsetY) / capturaLayout.renderScale,
        };
      },
      dipAFisico: (punto) => punto,
    });
  }

  it('ES-050: convierte cada línea en un elemento de texto con bbox físico', async () => {
    const detectados = await buildProvider().detectar(captura);

    expect(detectados).toHaveLength(1); // "ruido" cae por confianza baja
    const element = detectados[0];
    expect(element.fuente).toBe('ocr');
    expect(element.controlType).toBe('Text');
    expect(element.name).toBe('MINECRAFT: JAVA EDITION');
    // x0=240 -> dip 240/0.5333 ≈ 450; y0=340 -> (340-96)/0.5333 ≈ 458 (esquina sup-izq)
    expect(element.bboxFisico.x).toBe(450);
    expect(element.bboxFisico.y).toBe(458);
    expect(element.bboxFisico.width).toBeGreaterThan(0);
    expect(element.bboxFisico.height).toBeGreaterThan(0);
  });

  it('ES-051: sin layout no arriesga cajas mal mapeadas', async () => {
    const sinLayout = { base64: 'img', layout: null, actualWidth: 0, actualHeight: 0 } as unknown as CompositeScreenshot;
    const detectados = await buildProvider().detectar(sinLayout);
    expect(detectados).toEqual([]);
  });
});
