import type { PowerShellWorker } from '../native-worker/powershell-worker';
import type { CompositeScreenshot } from '../screenshot-capture';
import type { ScreenshotLayout } from '../types';
import {
  createCompositeElementSource,
  type CompositeElementSource,
} from './composite-element-source';
import { createOcrElementSource, type PhysicalPoint } from './ocr-element-source';
import { createUiaElementSource } from './uia-element-source';
import type { ElementSourceProvider } from './types';
import type { OcrTextBox } from '../../ocr-service';

export { createCompositeElementSource, fuseDetectedElements, iou, detectedToUIElement } from './composite-element-source';
export type { CompositeElementSource } from './composite-element-source';
export { createUiaElementSource } from './uia-element-source';
export { createOcrElementSource } from './ocr-element-source';
export { createVisualElementSource } from './visual-element-source';
export type { DetectedElement, ElementSource, ElementSourceProvider, Rect } from './types';

export type DesktopElementSourceConfig = {
  uiaWorkerEnabled: boolean;
  ocrElementsEnabled: boolean;
  maxDetectedElements: number;
  elementDedupIouThreshold: number;
  uiaSparseThreshold: number;
  uiaWakeDelayMs: number;
  /** Si UIA devuelve >= este numero, no se corre OCR (ahorro de latencia). */
  sufficientElementCount: number;
  /** Si UIA devuelve >= este numero, tampoco se corre el parser visual (ONNX caro). */
  visualSkipWhenUiaRich: number;
};

export type DesktopElementSourceDeps = {
  /** Worker UIA persistente; null en plataformas sin accesibilidad nativa. */
  worker: PowerShellWorker | null;
  /** Obtiene la captura de decision cuando el llamador no la provee. */
  capturar: () => Promise<CompositeScreenshot>;
  reconocerTextos: (base64: string) => Promise<{ lineas: OcrTextBox[]; palabras: OcrTextBox[] }>;
  mapImagenADip: (x: number, y: number, layout: ScreenshotLayout | null) => PhysicalPoint | null;
  dipAFisico: (punto: PhysicalPoint) => PhysicalPoint;
  /** Proveedor visual (OmniParser/ONNX) opcional; se agrega en Fase 2. */
  visualProvider?: ElementSourceProvider | null;
  config: DesktopElementSourceConfig;
};

/**
 * Ensambla la fuente de elementos del Set-of-Marks a partir de las capacidades
 * disponibles. Cada fuente es opcional segun flags/plataforma; si todas fallan,
 * el pipeline cae a grid (comportamiento previo).
 */
export function buildDesktopElementSource(deps: DesktopElementSourceDeps): CompositeElementSource {
  const providers: ElementSourceProvider[] = [];

  // UIA primero (exacto, semantico) — solo Windows con worker.
  if (deps.config.uiaWorkerEnabled && deps.worker) {
    providers.push(createUiaElementSource({
      worker: deps.worker,
      sparseThreshold: deps.config.uiaSparseThreshold,
      wakeDelayMs: deps.config.uiaWakeDelayMs,
      maxElements: Math.max(deps.config.maxDetectedElements * 3, 120),
    }));
  }

  // OCR universal (apps con texto sin arbol de accesibilidad).
  if (deps.config.ocrElementsEnabled) {
    providers.push(createOcrElementSource({
      reconocerTextos: deps.reconocerTextos,
      mapImagenADip: deps.mapImagenADip,
      dipAFisico: deps.dipAFisico,
    }));
  }

  // Visual (apps 100% opacas) — Fase 2, degradacion elegante si no esta.
  if (deps.visualProvider) {
    providers.push(deps.visualProvider);
  }

  return createCompositeElementSource({
    providers,
    capturar: deps.capturar,
    maxDetectedElements: deps.config.maxDetectedElements,
    dedupIouThreshold: deps.config.elementDedupIouThreshold,
    sufficientPriorityElements: deps.config.sufficientElementCount,
    visualSkipWhenUiaRich: deps.config.visualSkipWhenUiaRich,
  });
}
