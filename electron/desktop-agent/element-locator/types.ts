/**
 * Contratos del localizador de elementos por texto visible.
 *
 * La precision viene de medir donde esta el elemento con una fuente confiable,
 * no de que el modelo estime pixeles finales. La pista espacial siempre esta
 * en coordenadas de la imagen principal que vio el modelo; cada proveedor
 * conserva tambien coordenadas fisicas para ejecutar el click.
 */

export type ElementSource = 'uia' | 'ocr';

export type ImagePoint = { x: number; y: number };
export type PhysicalPoint = { x: number; y: number };
export type Rect = { x: number; y: number; width: number; height: number };

export type BlockedTarget = {
  texto?: string;
  centroImagen?: ImagePoint;
  centroFisico?: PhysicalPoint;
  radioImagen?: number;
  radioFisico?: number;
  reason?: string;
};

/**
 * Pista espacial: coordenada aproximada en espacio IMAGEN de donde el modelo ve
 * el elemento. Sirve para desambiguar textos repetidos sin mezclar coordenadas
 * de screenshot con pixeles fisicos.
 */
export type SpatialHint = ImagePoint;

export type LocateOptions = {
  pista?: SpatialHint;
  bloqueados?: BlockedTarget[];
};

export type LocatedElement = {
  /** Texto real del elemento encontrado (puede diferir en mayusculas/acentos del buscado). */
  texto: string;
  /** Centro clickeable en pixeles fisicos de pantalla. */
  centroFisico: PhysicalPoint;
  /** Caja fisica medida por la fuente, cuando esta disponible. */
  bboxFisico?: Rect;
  /** Centro del candidato en la imagen de decision, para ranking y trazabilidad. */
  centroImagen?: ImagePoint;
  /** Caja del candidato en la imagen de decision, cuando esta disponible. */
  bboxImagen?: Rect;
  fuente: ElementSource;
  /** Confianza de la fuente: UIA=1; OCR=tesseract. */
  confianza: number;
  /** Score textual bruto: 3 exacto, 2 prefijo, 1 contiene/parcial. */
  textScore: number;
  /** Score espacial 0-1 respecto a la pista de imagen; 0 si no hubo pista usable. */
  spatialScore: number;
  /** Explicacion corta de por que gano el candidato. */
  rankingReason: string;
  /** Tipo de control cuando la fuente lo conoce (solo accesibilidad). */
  controlType?: string;
};

/** Resumen de lo que cada proveedor intento, para diagnostico y mensajes al modelo. */
export type LocateAttempt = {
  fuente: ElementSource;
  /** Cuantos candidatos (elementos/textos) examino el proveedor. */
  escaneados: number;
  encontrado: boolean;
  error?: string;
};

export type LocateResult = {
  elemento: LocatedElement | null;
  intentos: LocateAttempt[];
};

export interface ElementLocatorProvider {
  readonly fuente: ElementSource;
  /** false cuando la plataforma/capacidad no aplica (p.ej. UIA fuera de Windows). */
  disponible(): boolean;
  localizar(textoObjetivo: string, options?: LocateOptions): Promise<{ elemento: LocatedElement | null; escaneados: number }>;
}
