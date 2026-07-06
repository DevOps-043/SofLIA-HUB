import type { OcrTextBox } from '../../ocr-service';
import type { ScreenshotLayout } from '../types';
import { pickBestCandidate } from './candidate-selection';
import type { ElementLocatorProvider, LocatedElement, PhysicalPoint, Rect } from './types';

/**
 * Proveedor OCR: la via UNIVERSAL de medicion. Lee el texto de los pixeles de
 * una captura fresca (tesseract.js, ya en el stack) y obtiene su bounding box
 * en espacio imagen; luego lo convierte a pixeles fisicos por el MISMO
 * pipeline imagen -> DIP -> fisico que usan los clicks del agente (par
 * imagen/layout autoconsistente). Funciona para cualquier tecnologia de app
 * (Chromium, Java, C++, terminales, juegos) y cualquier plataforma donde
 * exista captura de pantalla, porque ve exactamente lo que ve el usuario.
 */

export type OcrCapture = { base64: string; layout: ScreenshotLayout | null };

export type OcrLocatorDeps = {
  /** Captura de decision preferente; fallback a captura fresca sin mutar layout. */
  capturarPantalla: () => Promise<OcrCapture>;
  reconocerTextos: (base64: string) => Promise<{ lineas: OcrTextBox[]; palabras: OcrTextBox[] }>;
  mapImagenADip: (x: number, y: number, layout: ScreenshotLayout | null) => PhysicalPoint | null;
  dipAFisico: (punto: PhysicalPoint) => PhysicalPoint;
  /** Confianza minima de tesseract para considerar un texto (0-1). */
  confianzaMinima?: number;
};

const DEFAULT_MIN_CONFIDENCE = 0.35;

export function createOcrLocatorProvider(deps: OcrLocatorDeps): ElementLocatorProvider {
  const confianzaMinima = deps.confianzaMinima ?? DEFAULT_MIN_CONFIDENCE;
  return {
    fuente: 'ocr',
    disponible: () => true,
    async localizar(textoObjetivo: string, options) {
      const captura = await deps.capturarPantalla();
      if (!captura.layout) return { elemento: null, escaneados: 0 };
      const layout = captura.layout;

      const { lineas, palabras } = await deps.reconocerTextos(captura.base64);
      // Lineas primero: objetivos multi-palabra ("MINECRAFT: JAVA EDITION")
      // viven en una linea; las palabras sueltas cubren botones cortos.
      const boxes = [...lineas, ...palabras].filter((box) => box.confianza >= confianzaMinima);

      // Cada candidato conserva imagen + fisico: ranking en imagen, click en fisico.
      const candidatos = boxes.flatMap((box) => {
        const centroImagen = { x: (box.bbox.x0 + box.bbox.x1) / 2, y: (box.bbox.y0 + box.bbox.y1) / 2 };
        const dip = deps.mapImagenADip(centroImagen.x, centroImagen.y, layout);
        if (!dip) return [];
        const fisico = deps.dipAFisico(dip);
        const bboxFisico = imagenABboxFisico(box.bbox, layout, deps);
        return [{
          box,
          texto: box.texto,
          centroImagen,
          centroFisico: { x: Math.round(fisico.x), y: Math.round(fisico.y) },
          bboxImagen: {
            x: box.bbox.x0,
            y: box.bbox.y0,
            width: Math.max(1, box.bbox.x1 - box.bbox.x0),
            height: Math.max(1, box.bbox.y1 - box.bbox.y0),
          },
          bboxFisico,
          area: (box.bbox.x1 - box.bbox.x0) * (box.bbox.y1 - box.bbox.y0),
          sourceConfidence: box.confianza,
        }];
      });

      const mejor = pickBestCandidate(candidatos, textoObjetivo, options);
      if (!mejor) return { elemento: null, escaneados: candidatos.length };

      const elemento: LocatedElement = {
        texto: mejor.candidato.box.texto,
        centroFisico: mejor.candidato.centroFisico,
        bboxFisico: mejor.candidato.bboxFisico,
        centroImagen: mejor.candidato.centroImagen,
        bboxImagen: mejor.candidato.bboxImagen,
        fuente: 'ocr',
        confianza: mejor.candidato.box.confianza,
        textScore: mejor.textScore,
        spatialScore: mejor.spatialScore,
        rankingReason: mejor.rankingReason,
      };
      return { elemento, escaneados: candidatos.length };
    },
  };
}

function imagenABboxFisico(
  bbox: { x0: number; y0: number; x1: number; y1: number },
  layout: ScreenshotLayout,
  deps: Pick<OcrLocatorDeps, 'mapImagenADip' | 'dipAFisico'>,
): Rect | undefined {
  const dipTopLeft = deps.mapImagenADip(bbox.x0, bbox.y0, layout);
  const dipBottomRight = deps.mapImagenADip(bbox.x1, bbox.y1, layout);
  if (!dipTopLeft || !dipBottomRight) return undefined;
  const topLeft = deps.dipAFisico(dipTopLeft);
  const bottomRight = deps.dipAFisico(dipBottomRight);
  return {
    x: Math.round(Math.min(topLeft.x, bottomRight.x)),
    y: Math.round(Math.min(topLeft.y, bottomRight.y)),
    width: Math.max(1, Math.round(Math.abs(bottomRight.x - topLeft.x))),
    height: Math.max(1, Math.round(Math.abs(bottomRight.y - topLeft.y))),
  };
}
