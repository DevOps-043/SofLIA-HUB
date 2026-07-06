import type { PowerShellWorker } from '../native-worker/powershell-worker';
import type { WorkerElement } from '../native-worker/worker-protocol';
import { pickBestCandidate } from './candidate-selection';
import type { ElementLocatorProvider, ImagePoint, LocatedElement, LocateOptions, Rect, SpatialHint } from './types';

/**
 * Proveedor de accesibilidad nativa (UI Automation, Windows) sobre el worker
 * persistente de PowerShell.
 *
 * Detalle critico para apps Chromium/Electron/CEF y Java: construyen su arbol
 * de accesibilidad PEREZOSAMENTE. La primera consulta UIA dispara la
 * construccion; por eso el worker consulta, y si el arbol viene casi vacio,
 * espera y RECONSULTA (despertar de accesibilidad) antes de responder. Sin ese
 * despertar, apps como el Minecraft Launcher reportan ~4 elementos aunque
 * tengan cientos.
 *
 * El worker devuelve los elementos con nombre y sus rectangulos en PIXELES
 * FISICOS; el matching/puntuacion vive aqui (JS puro, testeable).
 */

const DEFAULT_SPARSE_THRESHOLD = 8;
const DEFAULT_WAKE_DELAY_MS = 1200;
const DEFAULT_MAX_ELEMENTS = 250;

export function createUiaLocatorProvider(deps: {
  worker: PowerShellWorker;
  sparseThreshold?: number;
  wakeDelayMs?: number;
  maxElements?: number;
  mapFisicoAImagen?: (x: number, y: number) => ImagePoint | null;
}): ElementLocatorProvider {
  return {
    fuente: 'uia',
    disponible: () => process.platform === 'win32',
    async localizar(textoObjetivo: string, options?: LocateOptions) {
      const response = await deps.worker.send({
        cmd: 'locateByText',
        sparseThreshold: deps.sparseThreshold ?? DEFAULT_SPARSE_THRESHOLD,
        wakeDelayMs: deps.wakeDelayMs ?? DEFAULT_WAKE_DELAY_MS,
        maxElements: deps.maxElements ?? DEFAULT_MAX_ELEMENTS,
      });

      if (!response.ok || response.cmd !== 'locateByText') {
        const error = response.ok ? 'respuesta inesperada del worker' : response.error;
        throw new Error(`Worker UIA: ${error}`);
      }

      const mejor = pickBestElement(response.elements, textoObjetivo, options, deps.mapFisicoAImagen);
      if (!mejor) return { elemento: null, escaneados: response.scanned };

      const elemento: LocatedElement = {
        texto: mejor.element.name,
        centroFisico: { x: mejor.element.clickX, y: mejor.element.clickY },
        bboxFisico: { ...mejor.element.rect },
        centroImagen: mejor.centroImagen,
        bboxImagen: mejor.bboxImagen,
        fuente: 'uia',
        confianza: 1,
        textScore: mejor.textScore,
        spatialScore: mejor.spatialScore,
        rankingReason: mejor.rankingReason,
        controlType: mejor.element.controlType,
      };
      return { elemento, escaneados: response.scanned };
    },
  };
}

/** Elige el mejor elemento por texto y, ante empate, cercanía a la pista (o menor área). */
export function pickBestElement(
  elements: WorkerElement[],
  textoObjetivo: string,
  options?: LocateOptions | SpatialHint,
  mapFisicoAImagen?: (x: number, y: number) => ImagePoint | null,
): { element: WorkerElement; score: number; textScore: number; spatialScore: number; rankingReason: string; centroImagen?: ImagePoint; bboxImagen?: Rect } | null {
  const best = pickBestCandidate(
    elements.map((element) => {
      const centroImagen = mapFisicoAImagen
        ? mapFisicoAImagen(element.clickX, element.clickY) ?? undefined
        : { x: element.clickX, y: element.clickY };
      return {
        element,
        texto: element.name,
        centroFisico: { x: element.clickX, y: element.clickY },
        centroImagen,
        bboxFisico: { ...element.rect },
        bboxImagen: mapRectFisicoAImagen(element.rect, mapFisicoAImagen),
        area: element.rect.width * element.rect.height,
        sourceConfidence: 1,
      };
    }),
    textoObjetivo,
    options,
  );
  return best
    ? {
      element: best.candidato.element,
      score: best.score,
      textScore: best.textScore,
      spatialScore: best.spatialScore,
      rankingReason: best.rankingReason,
      centroImagen: best.candidato.centroImagen,
      bboxImagen: best.candidato.bboxImagen,
    }
    : null;
}

function mapRectFisicoAImagen(
  rect: Rect,
  mapFisicoAImagen?: (x: number, y: number) => ImagePoint | null,
): Rect | undefined {
  if (!mapFisicoAImagen) return undefined;
  const topLeft = mapFisicoAImagen(rect.x, rect.y);
  const bottomRight = mapFisicoAImagen(rect.x + rect.width, rect.y + rect.height);
  if (!topLeft || !bottomRight) return undefined;
  return {
    x: Math.min(topLeft.x, bottomRight.x),
    y: Math.min(topLeft.y, bottomRight.y),
    width: Math.max(1, Math.abs(bottomRight.x - topLeft.x)),
    height: Math.max(1, Math.abs(bottomRight.y - topLeft.y)),
  };
}
