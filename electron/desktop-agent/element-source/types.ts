/**
 * Contratos de la FUENTE DE ELEMENTOS del Set-of-Marks.
 *
 * Diferencia con `element-locator/` (vecino): aquel hace *find-one-by-text*
 * (localizar UN elemento por su texto); este hace *parse-whole-screen* (producir
 * la LISTA completa de elementos interactuables de la pantalla para marcarlos
 * `[N]` sobre la captura). El modelo elige luego `click_element` por id en vez
 * de estimar pixeles.
 *
 * Cada proveedor mide de una forma distinta (accesibilidad UIA, lectura visual
 * OCR, deteccion visual OmniParser) y reporta cajas en PIXELES FISICOS de
 * pantalla — la misma unidad que usa el resto del pipeline de coordenadas, para
 * que la marca y el click caigan en el mismo lugar sin conversiones extra.
 */

import type { CompositeScreenshot } from '../screenshot-capture';

export type Rect = { x: number; y: number; width: number; height: number };

export type ElementSource = 'uia' | 'ocr' | 'visual';

export type DetectedElement = {
  /** Caja delimitadora en pixeles FISICOS de pantalla. */
  bboxFisico: Rect;
  /** Texto del elemento cuando la fuente lo conoce (UIA/OCR); ausente en visual. */
  name?: string;
  /** Tipo de control ('Button' | 'Text' | 'icon' | ...); normaliza al vocabulario UIA. */
  controlType: string;
  fuente: ElementSource;
  /** 0-1: confianza de la deteccion (UIA = 1; OCR = confianza tesseract; visual = score). */
  confianza: number;
};

/**
 * Proveedor de una fuente de elementos. Recibe la captura de DECISION (la imagen
 * que vera el modelo) para poder leerla (OCR/visual) o ignorarla (UIA lee la
 * pantalla viva). Devuelve las cajas en pixeles fisicos.
 */
export interface ElementSourceProvider {
  readonly fuente: ElementSource;
  /** false cuando la plataforma/capacidad no aplica (p.ej. UIA fuera de Windows). */
  disponible(): boolean;
  detectar(captura: CompositeScreenshot): Promise<DetectedElement[]>;
}
