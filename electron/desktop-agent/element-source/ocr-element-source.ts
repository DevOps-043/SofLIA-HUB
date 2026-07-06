import type { OcrTextBox } from '../../ocr-service';
import type { CompositeScreenshot } from '../screenshot-capture';
import type { ScreenshotLayout } from '../types';
import type { DetectedElement, ElementSourceProvider, Rect } from './types';

/**
 * Fuente de elementos por lectura visual (OCR, universal). Convierte cada LINEA
 * de texto reconocida en un elemento de tipo texto, con su caja en pixeles
 * FISICOS. Usa el MISMO pipeline imagen -> DIP -> fisico que los clicks, sobre
 * la captura de decision, para que la marca `[N]` caiga exactamente sobre el
 * texto que ve el usuario.
 *
 * Cubre apps sin arbol de accesibilidad (Chromium/Electron/juegos con texto
 * como el Minecraft Launcher): donde UIA no ve nada, el modelo igual recibe
 * elementos numerados y deja de estimar coordenadas.
 *
 * Se prefieren LINEAS sobre palabras: una linea agrupa el texto de un control
 * ("MINECRAFT: JAVA EDITION") en un solo elemento clickeable, evitando decenas
 * de marcas por palabra suelta.
 */

const DEFAULT_MIN_CONFIDENCE = 0.35;

export type PhysicalPoint = { x: number; y: number };

export type OcrElementSourceDeps = {
  reconocerTextos: (base64: string) => Promise<{ lineas: OcrTextBox[]; palabras: OcrTextBox[] }>;
  mapImagenADip: (x: number, y: number, layout: ScreenshotLayout | null) => PhysicalPoint | null;
  dipAFisico: (punto: PhysicalPoint) => PhysicalPoint;
  /** Confianza minima de tesseract para considerar un texto (0-1). */
  confianzaMinima?: number;
};

export function createOcrElementSource(deps: OcrElementSourceDeps): ElementSourceProvider {
  const confianzaMinima = deps.confianzaMinima ?? DEFAULT_MIN_CONFIDENCE;
  return {
    fuente: 'ocr',
    disponible: () => true,
    async detectar(captura: CompositeScreenshot): Promise<DetectedElement[]> {
      const layout = captura.layout;
      if (!layout) return [];

      const { lineas } = await deps.reconocerTextos(captura.base64);
      const elementos: DetectedElement[] = [];
      for (const linea of lineas) {
        if (linea.confianza < confianzaMinima) continue;
        const bbox = imagenABboxFisico(linea.bbox, layout, deps);
        if (!bbox) continue;
        elementos.push({
          bboxFisico: bbox,
          name: linea.texto,
          controlType: 'Text',
          fuente: 'ocr',
          confianza: linea.confianza,
        });
      }
      return elementos;
    },
  };
}

/** Convierte una caja en pixeles de imagen a pixeles fisicos via imagen -> DIP -> fisico. */
function imagenABboxFisico(
  bbox: { x0: number; y0: number; x1: number; y1: number },
  layout: ScreenshotLayout,
  deps: Pick<OcrElementSourceDeps, 'mapImagenADip' | 'dipAFisico'>,
): Rect | null {
  const dipTopLeft = deps.mapImagenADip(bbox.x0, bbox.y0, layout);
  const dipBottomRight = deps.mapImagenADip(bbox.x1, bbox.y1, layout);
  if (!dipTopLeft || !dipBottomRight) return null;
  const topLeft = deps.dipAFisico(dipTopLeft);
  const bottomRight = deps.dipAFisico(dipBottomRight);
  const x = Math.round(Math.min(topLeft.x, bottomRight.x));
  const y = Math.round(Math.min(topLeft.y, bottomRight.y));
  const width = Math.max(1, Math.round(Math.abs(bottomRight.x - topLeft.x)));
  const height = Math.max(1, Math.round(Math.abs(bottomRight.y - topLeft.y)));
  return { x, y, width, height };
}
