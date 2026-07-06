import type { PowerShellWorker } from '../native-worker/powershell-worker';
import type { WorkerElement } from '../native-worker/worker-protocol';
import type { CompositeScreenshot } from '../screenshot-capture';
import type { DetectedElement, ElementSourceProvider } from './types';

/**
 * Fuente de elementos por accesibilidad nativa (UI Automation, Windows) sobre el
 * worker persistente de PowerShell. Reemplaza el spawn de 4 s de `ui-elements.ts`.
 *
 * Igual que el locator, aprovecha el "despertar de accesibilidad": apps
 * Chromium/Electron/Java construyen su arbol perezosamente, asi que el worker
 * consulta, y si viene casi vacio, espera y RECONSULTA. El worker ya devuelve
 * nombre, controlType y rect en PIXELES FISICOS listos para marcar/clickear.
 */

const DEFAULT_SPARSE_THRESHOLD = 8;
const DEFAULT_WAKE_DELAY_MS = 1200;
const DEFAULT_MAX_ELEMENTS = 250;

export type UiaElementSourceDeps = {
  worker: PowerShellWorker;
  sparseThreshold?: number;
  wakeDelayMs?: number;
  /** Tope de candidatos que pide al worker (el composite recorta despues). */
  maxElements?: number;
};

export function createUiaElementSource(deps: UiaElementSourceDeps): ElementSourceProvider {
  return {
    fuente: 'uia',
    disponible: () => process.platform === 'win32',
    async detectar(_captura: CompositeScreenshot): Promise<DetectedElement[]> {
      const response = await deps.worker.send({
        cmd: 'listElements',
        sparseThreshold: deps.sparseThreshold ?? DEFAULT_SPARSE_THRESHOLD,
        wakeDelayMs: deps.wakeDelayMs ?? DEFAULT_WAKE_DELAY_MS,
        maxElements: deps.maxElements ?? DEFAULT_MAX_ELEMENTS,
      });

      if (!response.ok || response.cmd !== 'listElements') {
        const error = response.ok ? 'respuesta inesperada del worker' : response.error;
        throw new Error(`Fuente UIA: ${error}`);
      }

      return response.elements.map(toDetectedElement).filter((element) => isUsableRect(element.bboxFisico));
    },
  };
}

function toDetectedElement(element: WorkerElement): DetectedElement {
  return {
    bboxFisico: { x: element.rect.x, y: element.rect.y, width: element.rect.width, height: element.rect.height },
    name: element.name,
    controlType: element.controlType || 'Unknown',
    fuente: 'uia',
    confianza: 1,
  };
}

function isUsableRect(rect: { width: number; height: number }): boolean {
  return rect.width > 0 && rect.height > 0;
}
