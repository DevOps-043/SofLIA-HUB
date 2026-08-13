// Inventario de ventanas candidatas.
//
// Construirlo MUST ser barato: solo enumeracion de ventanas y miniaturas. Aqui
// no se invoca COM ni se recorre ningun arbol de accesibilidad, porque abrir el
// selector no debe costar lo que cuesta leer una aplicacion.

import {
  DESKTOP_CONTEXT_LIMITS,
  type DesktopContextInventory,
  type DesktopContextLevel,
  type DesktopWindowCandidate,
} from './types';

export interface WindowSource {
  id: string;
  name: string;
  thumbnail: string;
}

export interface InventoryDeps {
  listWindows: () => Promise<Array<{ title: string; process: string; pid: number }>>;
  getWindowSources: () => Promise<WindowSource[]>;
  /** Titulos de las ventanas del propio Pulse Hub, para excluirlas. */
  ownWindowTitles: () => string[];
  ownPid: number;
  platform: string;
}

/** Registro interno: anade la fuente de captura que el renderer no necesita ver. */
export interface DesktopWindowRecord extends DesktopWindowCandidate {
  sourceId: string;
}

/** Procesos de Office cuyo documento abierto se puede resolver por COM. */
const OFFICE_PROCESSES = new Set(['winword', 'excel', 'powerpnt']);

export function availableLevelsFor(platform: string): DesktopContextLevel[] {
  return platform === 'win32'
    ? ['documento', 'accesibilidad', 'captura']
    : ['captura'];
}

export async function buildInventory(
  deps: InventoryDeps,
): Promise<{ inventory: DesktopContextInventory; records: DesktopWindowRecord[] }> {
  const availableLevels = availableLevelsFor(deps.platform);
  const sources = await deps.getWindowSources().catch(() => [] as WindowSource[]);
  const ownTitles = new Set(deps.ownWindowTitles().filter(Boolean));

  const records = deps.platform === 'win32'
    ? await fromProcesses(deps, sources, ownTitles, availableLevels)
    : fromSources(sources, ownTitles);

  const limited = records.slice(0, DESKTOP_CONTEXT_LIMITS.maxCandidates);
  return {
    inventory: {
      candidates: limited.map(toCandidate),
      availableLevels,
      platform: deps.platform,
    },
    records: limited,
  };
}

/**
 * Windows: `listWindows` manda porque es la unica fuente con pid y proceso, que
 * es lo que necesitan los niveles A y B. Las miniaturas se cruzan por titulo.
 */
async function fromProcesses(
  deps: InventoryDeps,
  sources: WindowSource[],
  ownTitles: Set<string>,
  availableLevels: DesktopContextLevel[],
): Promise<DesktopWindowRecord[]> {
  const windows = await deps.listWindows().catch(() => []);
  const byTitle = groupSourcesByName(sources);

  return windows
    .filter((window) => window.title.trim() && window.pid !== deps.ownPid && !ownTitles.has(window.title))
    .map((window) => {
      const source = byTitle.get(window.title)?.shift();
      return {
        id: candidateId(window.pid, window.title),
        title: window.title,
        appName: window.process,
        pid: window.pid,
        thumbnail: source?.thumbnail ?? '',
        sourceId: source?.id ?? '',
        expectedLevel: expectedLevelFor(window.process, availableLevels),
      };
    });
}

/** Fuera de Windows solo hay captura, asi que basta con lo que da desktopCapturer. */
function fromSources(sources: WindowSource[], ownTitles: Set<string>): DesktopWindowRecord[] {
  return sources
    .filter((source) => source.name.trim() && !ownTitles.has(source.name))
    .map((source) => ({
      id: candidateId(0, source.name),
      title: source.name,
      appName: '',
      pid: 0,
      thumbnail: source.thumbnail,
      sourceId: source.id,
      expectedLevel: 'captura' as const,
    }));
}

function expectedLevelFor(processName: string, availableLevels: DesktopContextLevel[]): DesktopContextLevel {
  const normalized = processName.trim().toLowerCase();
  if (OFFICE_PROCESSES.has(normalized) && availableLevels.includes('documento')) return 'documento';
  if (availableLevels.includes('accesibilidad')) return 'accesibilidad';
  return 'captura';
}

function groupSourcesByName(sources: WindowSource[]): Map<string, WindowSource[]> {
  const grouped = new Map<string, WindowSource[]>();
  for (const source of sources) {
    const bucket = grouped.get(source.name);
    if (bucket) bucket.push(source);
    else grouped.set(source.name, [source]);
  }
  return grouped;
}

/** El renderer no necesita el sourceId, asi que no cruza la frontera IPC. */
function toCandidate(record: DesktopWindowRecord): DesktopWindowCandidate {
  return {
    id: record.id,
    title: record.title,
    appName: record.appName,
    pid: record.pid,
    thumbnail: record.thumbnail,
    expectedLevel: record.expectedLevel,
  };
}

/**
 * Identificador estable entre inventarios de la misma sesion: si el usuario
 * cierra y reabre el selector, lo que ya marco sigue marcado.
 */
function candidateId(pid: number, title: string): string {
  return `app-${pid}-${shortHash(`${pid}|${title}`)}`;
}

function shortHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36).padStart(6, '0').slice(0, 6);
}
