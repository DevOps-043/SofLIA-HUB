import type { UIElement } from '../planning-types';
import type { CompositeScreenshot } from '../screenshot-capture';
import type { DetectedElement, ElementSource, Rect } from './types';
import type { ElementSourceProvider } from './types';

/**
 * Orquestador que FUSIONA las fuentes de elementos en la lista unica que alimenta
 * el Set-of-Marks. Reglas:
 *  - Corre la fuente prioritaria (UIA) primero; si ya da suficientes elementos,
 *    puede omitir OCR para ahorrar latencia. La fuente visual ONNX, si existe,
 *    sigue corriendo para detectar controles opacos que UIA/OCR no nombran.
 *  - Deduplica por solapamiento de cajas (IoU): ante dos detecciones del mismo
 *    control gana la de mayor prioridad de fuente (UIA > OCR > visual).
 *  - Recorta a `maxDetectedElements` conservando las mas confiables, y numera
 *    los ids de forma estable (arriba->abajo, izquierda->derecha) para que las
 *    marcas `[N]` sean legibles.
 */

const PRIORIDAD_FUENTE: Record<ElementSource, number> = { uia: 0, ocr: 1, visual: 2 };

export type CompositeElementSourceDeps = {
  /** Fuentes en orden de prioridad (UIA primero). */
  providers: ElementSourceProvider[];
  /** Captura de decision a reutilizar; si no se pasa, se obtiene con esta funcion. */
  capturar: () => Promise<CompositeScreenshot>;
  maxDetectedElements: number;
  dedupIouThreshold: number;
  /** Si UIA devuelve >= este numero, se puede omitir OCR. */
  sufficientPriorityElements: number;
  /**
   * Si UIA devuelve >= este numero, se omite TAMBIEN el parser visual (ONNX es
   * caro por paso y en apps con arbol de accesibilidad rico no aporta controles
   * opacos). En apps sin accesibilidad (UIA escaso) el visual SI corre.
   */
  visualSkipWhenUiaRich: number;
};

export type CompositeElementSource = {
  /** Devuelve los elementos ya fusionados y mapeados a UIElement con ids estables. */
  obtenerElementos: (captura?: CompositeScreenshot) => Promise<UIElement[]>;
};

export function createCompositeElementSource(deps: CompositeElementSourceDeps): CompositeElementSource {
  return {
    async obtenerElementos(captura?: CompositeScreenshot): Promise<UIElement[]> {
      const capturaResuelta = captura ?? (await deps.capturar());
      const grupos: DetectedElement[][] = [];
      const fuentes: Array<{ fuente: ElementSource; disponible: boolean; count: number; omitida?: string }> = [];
      let uiaCorrio = false;
      let uiaCount = 0;

      for (const provider of deps.providers) {
        if (!provider.disponible()) {
          fuentes.push({ fuente: provider.fuente, disponible: false, count: 0 });
          continue;
        }
        const esPrioritaria = provider.fuente === 'uia';
        // Con UIA suficiente, OCR agrega ruido/latencia -> se omite.
        if (provider.fuente === 'ocr' && uiaCorrio && uiaCount >= deps.sufficientPriorityElements) {
          fuentes.push({ fuente: provider.fuente, disponible: true, count: 0, omitida: 'uia_suficiente' });
          continue;
        }
        // El visual (ONNX, caro) solo aporta en apps opacas; con UIA MUY rica se
        // omite para ahorrar ~1-2s por paso (Word, IDEs, apps nativas).
        if (provider.fuente === 'visual' && uiaCorrio && uiaCount >= deps.visualSkipWhenUiaRich) {
          fuentes.push({ fuente: provider.fuente, disponible: true, count: 0, omitida: 'uia_rica' });
          continue;
        }
        try {
          const detectados = await provider.detectar(capturaResuelta);
          grupos.push(detectados);
          fuentes.push({ fuente: provider.fuente, disponible: true, count: detectados.length });
          if (esPrioritaria) {
            uiaCorrio = true;
            uiaCount = detectados.length;
          }
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : String(error);
          console.warn(`[DesktopAgent] Fuente de elementos '${provider.fuente}' fallo:`, message);
        }
      }

      const fusionados = fuseDetectedElements(grupos, deps.dedupIouThreshold, deps.maxDetectedElements);
      console.log('[DesktopAgent] Fuentes Set-of-Marks:', JSON.stringify({
        fuentes,
        fusionados: fusionados.length,
        marcasFinales: Math.min(fusionados.length, deps.maxDetectedElements),
      }));
      return fusionados.map((element, index) => detectedToUIElement(element, index + 1));
    },
  };
}

/**
 * Fusiona grupos de detecciones: deduplica por IoU dando prioridad de fuente,
 * conserva las mas confiables hasta `max` y las ordena espacialmente. Pura.
 */
export function fuseDetectedElements(
  grupos: DetectedElement[][],
  iouThreshold: number,
  max: number,
): DetectedElement[] {
  // Orden de examen: primero mayor prioridad de fuente y, dentro de la misma,
  // mayor confianza. Asi el que se acepta ante un solapamiento es el mejor.
  const ordenados = grupos
    .flat()
    .filter((element) => element.bboxFisico.width > 0 && element.bboxFisico.height > 0)
    .sort((a, b) => {
      const prioridad = PRIORIDAD_FUENTE[a.fuente] - PRIORIDAD_FUENTE[b.fuente];
      if (prioridad !== 0) return prioridad;
      return b.confianza - a.confianza;
    });

  const aceptados: DetectedElement[] = [];
  for (const element of ordenados) {
    if (aceptados.length >= max) break;
    const solapa = aceptados.some((previo) => iou(previo.bboxFisico, element.bboxFisico) > iouThreshold);
    if (!solapa) aceptados.push(element);
  }

  // Numeracion estable para el humano/modelo: de arriba a abajo, luego de
  // izquierda a derecha (tolerancia vertical para filas de botones).
  return aceptados.sort((a, b) => {
    const deltaY = a.bboxFisico.y - b.bboxFisico.y;
    if (Math.abs(deltaY) > 12) return deltaY;
    return a.bboxFisico.x - b.bboxFisico.x;
  });
}

/** Intersection-over-Union de dos rectangulos en la misma unidad. Pura. */
export function iou(a: Rect, b: Rect): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.width, b.x + b.width);
  const y2 = Math.min(a.y + a.height, b.y + b.height);
  const interseccion = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  if (interseccion <= 0) return 0;
  const union = a.width * a.height + b.width * b.height - interseccion;
  return union > 0 ? interseccion / union : 0;
}

/** Mapea una deteccion a UIElement con el id dado. El bbox fisico va tal cual a
 * boundingRect (coords de escritorio) que es lo que espera el pipeline SoM. */
export function detectedToUIElement(element: DetectedElement, id: number): UIElement {
  return {
    id,
    name: element.name || '',
    controlType: element.controlType || 'Unknown',
    boundingRect: {
      x: element.bboxFisico.x,
      y: element.bboxFisico.y,
      width: element.bboxFisico.width,
      height: element.bboxFisico.height,
    },
    isEnabled: true,
    value: '',
  };
}
