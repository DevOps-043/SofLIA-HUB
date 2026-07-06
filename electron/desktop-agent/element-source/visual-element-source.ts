import type { CompositeScreenshot } from '../screenshot-capture';
import type { ScreenshotLayout } from '../types';
import type { VisualParser } from '../visual-parser/types';
import type { DetectedElement, ElementSourceProvider, Rect } from './types';
import type { PhysicalPoint } from './ocr-element-source';

/**
 * Fuente de elementos por deteccion VISUAL (OmniParser/ONNX). Ultima linea para
 * apps 100% opacas (sin arbol de accesibilidad y sin texto legible): juegos,
 * canvas, controles dibujados. El parser devuelve cajas de iconos en pixeles de
 * la imagen; aqui se convierten a fisicos por el MISMO pipeline imagen -> DIP ->
 * fisico que OCR, para que la marca `[N]` caiga sobre el control.
 *
 * No aporta `name` (el detector solo ubica, no describe): el modelo de vision
 * lee la imagen marcada y decide. controlType = 'icon'.
 */

export type VisualElementSourceDeps = {
  parser: VisualParser;
  mapImagenADip: (x: number, y: number, layout: ScreenshotLayout | null) => PhysicalPoint | null;
  dipAFisico: (punto: PhysicalPoint) => PhysicalPoint;
};

export function createVisualElementSource(deps: VisualElementSourceDeps): ElementSourceProvider {
  return {
    fuente: 'visual',
    disponible: () => deps.parser.disponible(),
    async detectar(captura: CompositeScreenshot): Promise<DetectedElement[]> {
      const layout = captura.layout;
      if (!layout) return [];

      const cajas = await deps.parser.detectar(captura.base64);
      const elementos: DetectedElement[] = [];
      for (const caja of cajas) {
        const bbox = imagenABboxFisico(caja, layout, deps);
        if (!bbox) continue;
        elementos.push({
          bboxFisico: bbox,
          controlType: 'icon',
          fuente: 'visual',
          confianza: caja.score,
        });
      }
      return elementos;
    },
  };
}

function imagenABboxFisico(
  caja: { x0: number; y0: number; x1: number; y1: number },
  layout: ScreenshotLayout,
  deps: Pick<VisualElementSourceDeps, 'mapImagenADip' | 'dipAFisico'>,
): Rect | null {
  const dipTopLeft = deps.mapImagenADip(caja.x0, caja.y0, layout);
  const dipBottomRight = deps.mapImagenADip(caja.x1, caja.y1, layout);
  if (!dipTopLeft || !dipBottomRight) return null;
  const topLeft = deps.dipAFisico(dipTopLeft);
  const bottomRight = deps.dipAFisico(dipBottomRight);
  const x = Math.round(Math.min(topLeft.x, bottomRight.x));
  const y = Math.round(Math.min(topLeft.y, bottomRight.y));
  const width = Math.max(1, Math.round(Math.abs(bottomRight.x - topLeft.x)));
  const height = Math.max(1, Math.round(Math.abs(bottomRight.y - topLeft.y)));
  return { x, y, width, height };
}
