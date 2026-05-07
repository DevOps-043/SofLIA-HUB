/**
 * Constantes y configuración estática del browser-web service.
 *
 * Centralizado para que ajustes de modelo, límites de UI o rutas de browsers
 * no requieran editar la clase principal.
 */

export const DEFAULT_MODEL = 'gemini-3-flash-preview';
export const DEFAULT_FALLBACK_MODEL = 'gemini-2.5-flash';

/** Cantidad máxima de elementos visibles enviados al modelo en cada snapshot. */
export const MAX_VISIBLE_ELEMENTS = 45;

/** Caracteres máximos del extracto de texto adjunto al snapshot. */
export const MAX_TEXT_EXCERPT = 1800;

/** Cantidad de entradas de historial que recibe el modelo en cada paso. */
export const MAX_HISTORY_ITEMS = 8;

/** Pausa fija después de cada acción para permitir que la UI se asiente. */
export const WAIT_AFTER_ACTION_MS = 450;

/**
 * Browsers soportados en Windows, en orden de preferencia. Se intenta cada
 * candidato hasta encontrar uno disponible. `channel` usa el browser
 * registrado por Playwright; `executablePath` apunta a binarios conocidos.
 */
export const WINDOWS_BROWSER_CANDIDATES = [
  { channel: 'msedge' as const },
  { channel: 'chrome' as const },
  { executablePath: 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe' },
  { executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe' },
  { executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' },
  { executablePath: 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe' },
];
