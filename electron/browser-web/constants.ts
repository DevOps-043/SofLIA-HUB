/**
 * Constantes y configuración estática del browser-web service.
 *
 * Centralizado para que ajustes de modelo, límites de UI o rutas de browsers
 * no requieran editar la clase principal.
 */

export const DEFAULT_MODEL = 'gemini-3.5-flash';
export const DEFAULT_FALLBACK_MODEL = 'gemini-3.1-flash-lite';

/** Cantidad máxima de elementos visibles enviados al modelo en cada snapshot. */
export const MAX_VISIBLE_ELEMENTS = 45;

/** Caracteres máximos del extracto de texto adjunto al snapshot. */
export const MAX_TEXT_EXCERPT = 1800;

/** Cantidad de entradas de historial que recibe el modelo en cada paso. */
export const MAX_HISTORY_ITEMS = 8;

/** Pausa fija después de cada acción para permitir que la UI se asiente. */
export const WAIT_AFTER_ACTION_MS = 450;

export type WindowsBrowserCandidate =
  | { channel: 'msedge' | 'chrome' }
  | { executablePath: string };

const CHROME_CANDIDATES: WindowsBrowserCandidate[] = [
  { channel: 'chrome' },
  { executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' },
  { executablePath: 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe' },
];

const EDGE_CANDIDATES: WindowsBrowserCandidate[] = [
  { channel: 'msedge' },
  { executablePath: 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe' },
  { executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe' },
];

let cachedCandidates: WindowsBrowserCandidate[] | null = null;

/**
 * Browsers soportados en Windows, ordenados segun el navegador PREDETERMINADO
 * del usuario (leido del registro: ProgId de la asociacion http). Antes Edge
 * iba fijo primero y el agente web siempre abria Edge aunque el usuario usara
 * Chrome. Se intenta cada candidato hasta encontrar uno disponible.
 */
export function getWindowsBrowserCandidates(): WindowsBrowserCandidate[] {
  if (cachedCandidates) return cachedCandidates;
  let progId = '';
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { execSync } = require('node:child_process') as typeof import('node:child_process');
    const out = execSync(
      'reg query "HKCU\\Software\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations\\http\\UserChoice" /v ProgId',
      { encoding: 'utf8', windowsHide: true, timeout: 3000 },
    );
    progId = /ProgId\s+REG_SZ\s+(\S+)/.exec(out)?.[1] ?? '';
  } catch {
    // Sin lectura del registro se usa el orden por defecto (Chrome primero).
  }
  const prefersEdge = /edge/i.test(progId);
  cachedCandidates = prefersEdge
    ? [...EDGE_CANDIDATES, ...CHROME_CANDIDATES]
    : [...CHROME_CANDIDATES, ...EDGE_CANDIDATES];
  console.log(`[BrowserWeb] Navegador predeterminado detectado: ${progId || 'desconocido'} → orden ${prefersEdge ? 'Edge' : 'Chrome'} primero`);
  return cachedCandidates;
}
