import { describe, expect, it, vi } from 'vitest';
import {
  clampBox,
  computeLetterbox,
  createOnnxVisualParser,
  decodeYoloV8Output,
  iouBox,
  mapBoxToOriginal,
  nonMaxSuppression,
  resolveYoloLayout,
  type VisualBox,
} from '../desktop-agent/visual-parser';
import { createVisualElementSource } from '../desktop-agent/element-source';
import type { CompositeScreenshot } from '../desktop-agent/screenshot-capture';
import type { ScreenshotLayout } from '../desktop-agent/types';

describe('Decode YOLOv8', () => {
  it('VP-001: decodifica cx,cy,w,h,score a cajas y filtra por umbral', () => {
    const numAnchors = 3;
    // Layout [feature, anchor] row-major: data[f*numAnchors + a]. 1 clase => 5 features.
    const data = new Float32Array(5 * numAnchors);
    const set = (f: number, a: number, v: number) => { data[f * numAnchors + a] = v; };
    // anchor 0 (score alto), anchor 1 (score bajo, se descarta), anchor 2 (score medio)
    set(0, 0, 100); set(1, 0, 100); set(2, 0, 20); set(3, 0, 10); set(4, 0, 0.9);
    set(0, 1, 50); set(1, 1, 50); set(2, 1, 8); set(3, 1, 8); set(4, 1, 0.02);
    set(0, 2, 200); set(1, 2, 150); set(2, 2, 40); set(3, 2, 30); set(4, 2, 0.5);

    const cajas = decodeYoloV8Output(data, { numAnchors, numClasses: 1, scoreThreshold: 0.05 });

    expect(cajas).toHaveLength(2);
    expect(cajas[0]).toMatchObject({ x0: 90, y0: 95, x1: 110, y1: 105 });
    expect(cajas[0].score).toBeCloseTo(0.9, 5);
    expect(cajas[1]).toMatchObject({ x0: 180, y0: 135, x1: 220, y1: 165 });
    expect(cajas[1].score).toBeCloseTo(0.5, 5);
  });

  it('VP-002: con varias clases toma el score maximo por ancla', () => {
    const numAnchors = 1;
    const data = new Float32Array(6 * numAnchors); // 4 + 2 clases
    data[0] = 10; data[1] = 10; data[2] = 4; data[3] = 4; // cx,cy,w,h
    data[4] = 0.2; data[5] = 0.7; // clase0, clase1
    const cajas = decodeYoloV8Output(data, { numAnchors, numClasses: 2, scoreThreshold: 0.05 });
    expect(cajas).toHaveLength(1);
    expect(cajas[0].score).toBeCloseTo(0.7, 5);
  });
});

describe('Layout de salida YOLO', () => {
  it('VP-005: detecta feature-major [1,5,8400] (el export validado de OmniParser)', () => {
    expect(resolveYoloLayout([1, 5, 8400])).toEqual({ layout: 'feature-major', numAnchors: 8400, numClasses: 1 });
  });

  it('VP-006: detecta anchor-major [1,8400,5] (re-export transpuesto)', () => {
    expect(resolveYoloLayout([1, 8400, 5])).toEqual({ layout: 'anchor-major', numAnchors: 8400, numClasses: 1 });
  });

  it('VP-007: decodifica anchor-major dando las mismas cajas que feature-major', () => {
    // Mismos datos logicos, distinta disposicion: anchor 0 = [cx,cy,w,h,score].
    const anchorMajor = new Float32Array([100, 100, 20, 10, 0.9, /*a1*/ 200, 150, 40, 30, 0.5]);
    const cajas = decodeYoloV8Output(anchorMajor, { numAnchors: 2, numClasses: 1, scoreThreshold: 0.05, layout: 'anchor-major' });
    expect(cajas).toHaveLength(2);
    expect(cajas[0]).toMatchObject({ x0: 90, y0: 95, x1: 110, y1: 105 });
    expect(cajas[1]).toMatchObject({ x0: 180, y0: 135, x1: 220, y1: 165 });
  });
});

describe('NMS', () => {
  it('VP-010: entre cajas solapadas conserva la de mayor score', () => {
    const a: VisualBox = { x0: 0, y0: 0, x1: 10, y1: 10, score: 0.9 };
    const b: VisualBox = { x0: 1, y0: 1, x1: 11, y1: 11, score: 0.5 }; // solapa con a
    const c: VisualBox = { x0: 100, y0: 100, x1: 110, y1: 110, score: 0.4 }; // disjunta

    const resultado = nonMaxSuppression([b, a, c], 0.3);

    expect(resultado.map((caja) => caja.score)).toEqual([0.9, 0.4]);
  });

  it('VP-011: iouBox de cajas idénticas es 1 y disjuntas 0', () => {
    expect(iouBox({ x0: 0, y0: 0, x1: 10, y1: 10, score: 1 }, { x0: 0, y0: 0, x1: 10, y1: 10, score: 1 })).toBe(1);
    expect(iouBox({ x0: 0, y0: 0, x1: 5, y1: 5, score: 1 }, { x0: 50, y0: 50, x1: 60, y1: 60, score: 1 })).toBe(0);
  });
});

describe('Letterbox', () => {
  it('VP-020: reescala manteniendo proporción y centra el padding', () => {
    const lb = computeLetterbox(1000, 500, 640);
    expect(lb.scale).toBeCloseTo(0.64, 5);
    expect(lb.resizedWidth).toBe(640);
    expect(lb.resizedHeight).toBe(320);
    expect(lb.padX).toBe(0);
    expect(lb.padY).toBe(160);
  });

  it('VP-021: mapea una caja de la entrada de vuelta a la imagen original', () => {
    const lb = computeLetterbox(1000, 500, 640);
    const original = mapBoxToOriginal({ x0: 64, y0: 160, x1: 640, y1: 480, score: 0.8 }, lb);
    expect(original.x0).toBeCloseTo(100, 5); // 64/0.64
    expect(original.y0).toBeCloseTo(0, 5);   // (160-160)/0.64
    expect(original.x1).toBeCloseTo(1000, 5);
    expect(original.y1).toBeCloseTo(500, 5);
  });

  it('VP-022: clampBox recorta a los límites de la imagen', () => {
    const recortada = clampBox({ x0: -5, y0: -5, x1: 1200, y1: 700, score: 0.5 }, 1000, 500);
    expect(recortada).toEqual({ x0: 0, y0: 0, x1: 1000, y1: 500, score: 0.5 });
  });
});

describe('Parser ONNX: degradación elegante', () => {
  it('VP-030: sin onnxruntime reporta no-disponible y no detecta', async () => {
    const parser = createOnnxVisualParser({
      resolveModelPath: () => '/ruta/modelo.onnx',
      loadOrt: () => null, // runtime ausente
      sharpModule: (() => ({})) as any,
    });
    expect(parser.disponible()).toBe(false);
    expect(await parser.detectar('data:image/png;base64,AAAA')).toEqual([]);
  });

  it('VP-031: sin modelo (ruta null) reporta no-disponible', () => {
    const parser = createOnnxVisualParser({
      resolveModelPath: () => null,
      loadOrt: () => ({}) as any,
      sharpModule: (() => ({})) as any,
    });
    expect(parser.disponible()).toBe(false);
  });

  it('VP-032: expone diagnostico cuando falta el modelo local', () => {
    const parser = createOnnxVisualParser({
      resolveModelPath: () => 'C:/no-existe/omniparser-icon-detect.onnx',
      loadOrt: () => ({}) as any,
      sharpModule: (() => ({})) as any,
    });

    expect(parser.diagnostico?.()).toMatchObject({
      runtimeDisponible: true,
      sharpDisponible: true,
      modeloExiste: false,
      disponible: false,
    });
  });
});

describe('Fuente visual (proveedor)', () => {
  const layout: ScreenshotLayout = {
    screenshotWidth: 1024,
    screenshotHeight: 768,
    offsetX: 0,
    offsetY: 0,
    renderScale: 0.5,
    virtualBounds: { x: 0, y: 0, width: 2048, height: 1536 },
    displayRegions: [{ displayId: '1', bounds: { x: 0, y: 0, width: 2048, height: 1536 }, left: 0, top: 0, width: 1024, height: 768 }],
  };
  const captura = { base64: 'img', layout, actualWidth: 1024, actualHeight: 768 } as CompositeScreenshot;

  it('VP-040: convierte cajas visuales a elementos icon con bbox físico', async () => {
    const parser = {
      disponible: () => true,
      detectar: vi.fn(async () => [{ x0: 100, y0: 100, x1: 140, y1: 140, score: 0.7 }]),
    };
    const source = createVisualElementSource({
      parser,
      mapImagenADip: (x, y, capturaLayout) => (capturaLayout ? { x: x / capturaLayout.renderScale, y: y / capturaLayout.renderScale } : null),
      dipAFisico: (punto) => punto,
    });

    const detectados = await source.detectar(captura);

    expect(detectados).toHaveLength(1);
    expect(detectados[0].fuente).toBe('visual');
    expect(detectados[0].controlType).toBe('icon');
    expect(detectados[0].name).toBeUndefined();
    // 100/0.5=200 .. 140/0.5=280
    expect(detectados[0].bboxFisico).toEqual({ x: 200, y: 200, width: 80, height: 80 });
  });

  it('VP-041: disponible refleja el parser subyacente', () => {
    const source = createVisualElementSource({
      parser: { disponible: () => false, detectar: async () => [] },
      mapImagenADip: () => null,
      dipAFisico: (punto) => punto,
    });
    expect(source.disponible()).toBe(false);
  });
});
