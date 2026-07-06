/**
 * Contratos del parser visual de elementos (estilo OmniParser).
 *
 * Solo detectamos CAJAS de iconos/controles (el detector YOLO de OmniParser),
 * NO su descripcion: el modelo de vision (Gemini) ya lee la imagen marcada, asi
 * que basta con ubicar donde hay elementos clickeables. Esto evita cargar el
 * captioner (Florence-2), que seria infra pesada e innecesaria.
 */

/** Caja en pixeles de la IMAGEN de entrada (mismo espacio que el bbox de OCR). */
export type VisualBox = {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** Score de deteccion 0-1. */
  score: number;
};

export interface VisualParser {
  /** false si onnxruntime o el modelo no estan disponibles (degradacion elegante). */
  disponible(): boolean;
  /** Diagnostico estructurado para logs de produccion y soporte. */
  diagnostico?(): {
    runtimeDisponible: boolean;
    sharpDisponible: boolean;
    modeloPath: string | null;
    modeloExiste: boolean;
    disponible: boolean;
  };
  /**
   * Detecta cajas de elementos sobre una imagen base64. Devuelve coordenadas en
   * pixeles de esa imagen (origen arriba-izquierda), ya reescaladas desde el
   * letterbox de inferencia.
   */
  detectar(base64: string): Promise<VisualBox[]>;
}
