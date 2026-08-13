// =============================================================================
// Pulse Hub - Contexto de aplicaciones de escritorio
// =============================================================================
// Contratos del adjunto de aplicaciones abiertas. El usuario marca ventanas en
// el chat y su contenido acompana al turno como contexto, igual que hoy hacen
// las pestanas del navegador integrado.
//
// La fidelidad NO es uniforme: cada aplicacion se resuelve por el primer nivel
// de la cascada que entregue contenido util. El nivel usado viaja en el adjunto
// para que ni la interfaz ni el modelo traten una captura como si fuera el
// documento completo.
// =============================================================================

/** Niveles de la cascada, de mayor a menor fidelidad. */
export type DesktopContextLevel = 'documento' | 'accesibilidad' | 'captura';

/** Avisos que acompanan a un adjunto y se muestran al usuario y al modelo. */
export type DesktopContextWarning =
  | 'cambios_sin_guardar'
  | 'contenido_truncado'
  | 'solo_visible'
  | 'sin_texto';

/** Ventana candidata del inventario. No lleva contenido: listarla es barato. */
export interface DesktopWindowCandidate {
  /** Identificador estable dentro de una sesion de inventario. */
  id: string;
  title: string;
  /** Nombre del proceso propietario; vacio cuando la plataforma no lo expone. */
  appName: string;
  pid: number;
  /** Miniatura 320x180 en dataURL, o cadena vacia si no se pudo obtener. */
  thumbnail: string;
  /** Nivel que se espera usar; la extraccion real puede degradar por debajo. */
  expectedLevel: DesktopContextLevel;
}

export interface DesktopContextInventory {
  candidates: DesktopWindowCandidate[];
  /** Niveles que esta plataforma puede entregar, de mayor a menor. */
  availableLevels: DesktopContextLevel[];
  platform: string;
}

/** Contenido extraido de una aplicacion, listo para inyectarse en el turno. */
export interface DesktopAppContextAttachment {
  appId: string;
  title: string;
  appName: string;
  level: DesktopContextLevel;
  /** Procedencia legible: nombre del archivo, o la ventana cuando no hay archivo. */
  source: string;
  text: string;
  /** Captura en dataURL cuando el nivel es `captura`. */
  image?: string;
  warnings: DesktopContextWarning[];
  charCount: number;
}

export const DESKTOP_CONTEXT_LIMITS = {
  /** Tope por aplicacion; al superarlo se trunca y se declara. */
  maxCharsPerApp: 40_000,
  /** Tope agregado del turno, compartido con las pestanas adjuntas. */
  maxCharsPerTurn: 120_000,
  maxCandidates: 40,
  /** Presupuesto por nivel de la cascada. Al agotarse se degrada al siguiente. */
  comTimeoutMs: 2_500,
  uiaTimeoutMs: 4_000,
  captureTimeoutMs: 3_000,
  /** Ancho maximo de la captura del nivel C, legible sin ser desproporcionada. */
  captureWidth: 1_280,
  captureHeight: 800,
} as const;

const CANDIDATE_ID_PATTERN = /^app-\d+-[a-z0-9]{6}$/;

/** True si el identificador tiene la forma que emite el inventario. */
export function isValidCandidateId(value: unknown): value is string {
  return typeof value === 'string' && CANDIDATE_ID_PATTERN.test(value);
}

/** Rollback: desactiva la capacidad completa sin tocar el resto del chat. */
export function isDesktopContextEnabled(): boolean {
  return process.env.SOFLIA_DISABLE_DESKTOP_CONTEXT !== '1';
}

/** Corta el texto al tope permitido y avisa cuando hubo recorte. */
export function truncateContextText(
  text: string,
  maxChars = DESKTOP_CONTEXT_LIMITS.maxCharsPerApp,
): { text: string; truncated: boolean } {
  if (text.length <= maxChars) return { text, truncated: false };
  return { text: text.slice(0, maxChars), truncated: true };
}
