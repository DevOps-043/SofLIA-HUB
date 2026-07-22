/**
 * Constantes y configuración estática del browser-web service.
 *
 * Centralizado para que ajustes de modelo, límites de UI o rutas de browsers
 * no requieran editar la clase principal.
 */

export const DEFAULT_MODEL = 'gemini-3.5-flash';
export const DEFAULT_FALLBACK_MODEL = 'gemini-3.5-flash-lite';

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

export type DefaultBrowserId = 'chrome' | 'edge' | 'brave' | 'opera' | 'vivaldi' | 'firefox' | 'desconocido';

export type DefaultBrowserInfo = {
  id: DefaultBrowserId;
  /** Nombre legible para logs y prompts (p.ej. "Google Chrome"). */
  nombre: string;
  /** ProgId crudo del registro de Windows (p.ej. "ChromeHTML", "MSEdgeHTM"). */
  progId: string;
  /** true si es Chromium y Playwright puede lanzarlo con executablePath/channel. */
  automatizable: boolean;
};

const BROWSER_NAMES: Record<DefaultBrowserId, string> = {
  chrome: 'Google Chrome',
  edge: 'Microsoft Edge',
  brave: 'Brave',
  opera: 'Opera',
  vivaldi: 'Vivaldi',
  firefox: 'Mozilla Firefox',
  desconocido: 'desconocido',
};

/** Mapea el ProgId de la asociacion http del registro a un navegador conocido. */
export function mapProgIdToBrowser(progId: string): DefaultBrowserId {
  if (/brave/i.test(progId)) return 'brave';
  if (/edge/i.test(progId)) return 'edge';
  if (/chrome/i.test(progId)) return 'chrome';
  if (/opera/i.test(progId)) return 'opera';
  if (/vivaldi/i.test(progId)) return 'vivaldi';
  if (/firefox/i.test(progId)) return 'firefox';
  return 'desconocido';
}

function programFiles(): string { return process.env['ProgramFiles'] || 'C:\\Program Files'; }
function programFilesX86(): string { return process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)'; }
function localAppData(): string { return process.env.LOCALAPPDATA || ''; }

function candidatesFor(id: DefaultBrowserId): WindowsBrowserCandidate[] {
  switch (id) {
    case 'chrome':
      return [
        { channel: 'chrome' },
        { executablePath: `${programFiles()}\\Google\\Chrome\\Application\\chrome.exe` },
        { executablePath: `${programFilesX86()}\\Google\\Chrome\\Application\\chrome.exe` },
        { executablePath: `${localAppData()}\\Google\\Chrome\\Application\\chrome.exe` },
      ];
    case 'edge':
      return [
        { channel: 'msedge' },
        { executablePath: `${programFiles()}\\Microsoft\\Edge\\Application\\msedge.exe` },
        { executablePath: `${programFilesX86()}\\Microsoft\\Edge\\Application\\msedge.exe` },
      ];
    case 'brave':
      return [
        { executablePath: `${programFiles()}\\BraveSoftware\\Brave-Browser\\Application\\brave.exe` },
        { executablePath: `${programFilesX86()}\\BraveSoftware\\Brave-Browser\\Application\\brave.exe` },
        { executablePath: `${localAppData()}\\BraveSoftware\\Brave-Browser\\Application\\brave.exe` },
      ];
    case 'opera':
      return [
        { executablePath: `${localAppData()}\\Programs\\Opera\\opera.exe` },
        { executablePath: `${programFiles()}\\Opera\\opera.exe` },
      ];
    case 'vivaldi':
      return [
        { executablePath: `${localAppData()}\\Vivaldi\\Application\\vivaldi.exe` },
        { executablePath: `${programFiles()}\\Vivaldi\\Application\\vivaldi.exe` },
      ];
    default:
      // Firefox no es Chromium: Playwright (chromium) no puede lanzarlo.
      return [];
  }
}

let cachedDefaultBrowser: DefaultBrowserInfo | null = null;
let cachedCandidates: WindowsBrowserCandidate[] | null = null;

/**
 * Navegador PREDETERMINADO del usuario, leido del registro de Windows
 * (ProgId de la asociacion http). Cubre Chrome, Edge, Brave, Opera, Vivaldi
 * y Firefox; este ultimo no es automatizable con Playwright chromium.
 */
export function getDefaultBrowserInfo(): DefaultBrowserInfo {
  if (cachedDefaultBrowser) return cachedDefaultBrowser;
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
    // Sin lectura del registro se reporta desconocido y se usa el orden por defecto.
  }
  const id = mapProgIdToBrowser(progId);
  cachedDefaultBrowser = {
    id,
    nombre: BROWSER_NAMES[id],
    progId,
    automatizable: id !== 'firefox' && id !== 'desconocido',
  };
  console.log(`[BrowserWeb] Navegador predeterminado: ${cachedDefaultBrowser.nombre} (ProgId: ${progId || 'no detectado'})`);
  return cachedDefaultBrowser;
}

/**
 * Browsers soportados en Windows, ordenados segun el navegador PREDETERMINADO
 * del usuario. Antes Edge iba fijo primero y el agente web siempre abria Edge
 * aunque el usuario usara Chrome; ahora el predeterminado (si es Chromium) va
 * primero y Chrome/Edge quedan como fallback. Se intenta cada candidato hasta
 * encontrar uno disponible.
 */
export function getWindowsBrowserCandidates(): WindowsBrowserCandidate[] {
  if (cachedCandidates) return cachedCandidates;
  const defaultBrowser = getDefaultBrowserInfo();
  const ordered: WindowsBrowserCandidate[] = [
    ...(defaultBrowser.automatizable ? candidatesFor(defaultBrowser.id) : []),
    ...candidatesFor('chrome'),
    ...candidatesFor('edge'),
  ];
  // Deduplicar conservando el primer orden (predeterminado primero).
  const seen = new Set<string>();
  cachedCandidates = ordered.filter((candidate) => {
    const key = 'channel' in candidate ? `channel:${candidate.channel}` : `path:${candidate.executablePath.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return cachedCandidates;
}
