import type { VisualBox } from './types';

/**
 * Post-proceso de la salida cruda de un detector YOLOv8 (el icon_detect de
 * OmniParser exportado a ONNX). PURO y testeable sin cargar el modelo.
 *
 * Formato de salida YOLOv8. Cada ancla lleva [cx, cy, w, h, score_clase...] con
 * las coordenadas en pixeles del tamano de entrada (p.ej. 640) y los scores YA
 * activados (sigmoid) en [0,1] — YOLOv8 no tiene objectness, el score del ancla
 * es el maximo score de clase. Dos disposiciones posibles del tensor:
 *   - 'feature-major' [1, 4+nc, anchors]  -> valor(f,a) = data[f*anchors + a]
 *   - 'anchor-major'  [1, anchors, 4+nc]  -> valor(f,a) = data[a*(4+nc) + f]
 * El export validado de OmniParser icon_detect es feature-major ([1,5,8400]);
 * `resolveYoloLayout` detecta el otro caso por si un re-export lo transpone.
 */

export type YoloLayout = 'feature-major' | 'anchor-major';

export type DecodeYoloOptions = {
  numAnchors: number;
  numClasses: number;
  scoreThreshold: number;
  /** Por defecto 'feature-major' (el export estandar/validado). */
  layout?: YoloLayout;
};

/**
 * Deduce el layout a partir de las dims [1, d1, d2]: el eje de anclas es el
 * grande (~8400) y el de caracteristicas el chico (4+nc). Evita decodificar
 * basura si un modelo viene transpuesto.
 */
export function resolveYoloLayout(dims: number[]): { layout: YoloLayout; numClasses: number; numAnchors: number } {
  const d1 = dims[1];
  const d2 = dims[2];
  // El eje mayor son las anclas; el menor, 4 + numClasses.
  if (d1 >= d2) {
    return { layout: 'anchor-major', numAnchors: d1, numClasses: Math.max(0, d2 - 4) };
  }
  return { layout: 'feature-major', numAnchors: d2, numClasses: Math.max(0, d1 - 4) };
}

export function decodeYoloV8Output(
  data: Float32Array | number[],
  opts: DecodeYoloOptions,
): VisualBox[] {
  const { numAnchors, numClasses, scoreThreshold } = opts;
  const layout = opts.layout ?? 'feature-major';
  const stride = 4 + numClasses;
  const at = layout === 'feature-major'
    ? (f: number, a: number) => data[f * numAnchors + a]
    : (f: number, a: number) => data[a * stride + f];
  const cajas: VisualBox[] = [];

  for (let a = 0; a < numAnchors; a++) {
    let mejorScore = 0;
    for (let c = 0; c < numClasses; c++) {
      const score = at(4 + c, a);
      if (score > mejorScore) mejorScore = score;
    }
    if (mejorScore < scoreThreshold) continue;

    const cx = at(0, a);
    const cy = at(1, a);
    const w = at(2, a);
    const h = at(3, a);
    cajas.push({
      x0: cx - w / 2,
      y0: cy - h / 2,
      x1: cx + w / 2,
      y1: cy + h / 2,
      score: mejorScore,
    });
  }
  return cajas;
}

/**
 * Non-Maximum Suppression: entre cajas muy solapadas (mismo control detectado
 * varias veces) conserva la de mayor score. PURA.
 */
export function nonMaxSuppression(cajas: VisualBox[], iouThreshold: number): VisualBox[] {
  const ordenadas = [...cajas].sort((a, b) => b.score - a.score);
  const conservadas: VisualBox[] = [];
  for (const caja of ordenadas) {
    const solapa = conservadas.some((previa) => iouBox(previa, caja) > iouThreshold);
    if (!solapa) conservadas.push(caja);
  }
  return conservadas;
}

/** Intersection-over-Union de dos cajas en formato x0,y0,x1,y1. PURA. */
export function iouBox(a: VisualBox, b: VisualBox): number {
  const x1 = Math.max(a.x0, b.x0);
  const y1 = Math.max(a.y0, b.y0);
  const x2 = Math.min(a.x1, b.x1);
  const y2 = Math.min(a.y1, b.y1);
  const interseccion = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  if (interseccion <= 0) return 0;
  const areaA = Math.max(0, a.x1 - a.x0) * Math.max(0, a.y1 - a.y0);
  const areaB = Math.max(0, b.x1 - b.x0) * Math.max(0, b.y1 - b.y0);
  const union = areaA + areaB - interseccion;
  return union > 0 ? interseccion / union : 0;
}
