// =============================================================================
// Borrado de datos de navegacion
// =============================================================================
// Equivalente al "Borrar datos de navegacion" de Chrome, acotado al perfil del
// usuario con sesion activa: la particion y los archivos de otro perfil no se
// tocan (ver `profile-scope`).
//
// SOBRE EL RANGO TEMPORAL. Chromium sabe acotar el borrado por fecha, pero
// Electron no lo expone: `ClearDataOptions` solo admite `dataTypes`, `origins` y
// `excludeOrigins`, y las cookies que devuelve no traen fecha de creacion, asi
// que tampoco se puede filtrar a mano. El historial SI puede acotarse porque es
// nuestro y cada visita guarda `visitedAt`.
//
// En vez de fingir que el rango se aplica a todo, cada resultado declara si lo
// respeto (`ignoredRange`). La interfaz lo muestra y el usuario sabe que paso.
// =============================================================================

export const BROWSING_DATA_CATEGORIES = [
  'historial',
  'cookies',
  'cache',
  'contrasenas',
  'permisos',
] as const;

export type BrowsingDataCategory = (typeof BROWSING_DATA_CATEGORIES)[number];

export const BROWSING_DATA_RANGES = [
  'ultima-hora',
  'ultimo-dia',
  'ultima-semana',
  'ultimo-mes',
  'todo',
] as const;

export type BrowsingDataRange = (typeof BROWSING_DATA_RANGES)[number];

/** Categorias que borran todo el perfil aunque se pida un rango. */
const RANGE_UNAWARE_CATEGORIES = new Set<BrowsingDataCategory>([
  'cookies',
  'cache',
  'contrasenas',
  'permisos',
]);

const RANGE_DURATIONS_MS: Record<Exclude<BrowsingDataRange, 'todo'>, number> = {
  'ultima-hora': 60 * 60 * 1000,
  'ultimo-dia': 24 * 60 * 60 * 1000,
  'ultima-semana': 7 * 24 * 60 * 60 * 1000,
  'ultimo-mes': 28 * 24 * 60 * 60 * 1000,
};

export interface BrowsingDataRequest {
  categories: BrowsingDataCategory[];
  range: BrowsingDataRange;
}

export interface BrowsingDataResult {
  category: BrowsingDataCategory;
  cleared: boolean;
  /** Elementos quitados, cuando la categoria puede contarlos. */
  removed?: number;
  /** True cuando la categoria borro todo por no poder acotarse al rango. */
  ignoredRange: boolean;
  error?: string;
}

export interface BrowsingDataSummary {
  range: BrowsingDataRange;
  results: BrowsingDataResult[];
}

export interface BrowsingDataDeps {
  clearHistorySince: (sinceIso: string | null) => Promise<number>;
  /** Cookies y almacenamiento de sitios de la particion del perfil activo. */
  clearSiteData: () => Promise<void>;
  clearCache: () => Promise<void>;
  clearPasswords: () => Promise<number>;
  clearSitePermissions: () => Promise<number>;
  now?: () => number;
}

/** Inicio del rango en ISO, o null cuando el rango es "todo". */
export function rangeStartIso(range: BrowsingDataRange, now: number): string | null {
  if (range === 'todo') return null;
  return new Date(now - RANGE_DURATIONS_MS[range]).toISOString();
}

/** Valida el payload del renderer antes de borrar nada. */
export function validateBrowsingDataRequest(raw: unknown): BrowsingDataRequest {
  const input = (raw ?? {}) as { categories?: unknown; range?: unknown };

  if (!Array.isArray(input.categories) || input.categories.length === 0) {
    throw new Error('Elige al menos un tipo de dato para borrar.');
  }
  const categories: BrowsingDataCategory[] = [];
  for (const value of input.categories) {
    if (!isCategory(value)) throw new Error('Tipo de dato de navegacion no reconocido.');
    if (!categories.includes(value)) categories.push(value);
  }

  const range = input.range;
  if (!isRange(range)) throw new Error('Rango de borrado no reconocido.');

  return { categories, range };
}

/**
 * Borra las categorias pedidas. Cada una falla de forma aislada: un error en
 * cookies no impide borrar el historial, y el resumen dice exactamente que se
 * borro y que no.
 */
export async function clearBrowsingData(
  request: BrowsingDataRequest,
  deps: BrowsingDataDeps,
): Promise<BrowsingDataSummary> {
  const now = deps.now?.() ?? Date.now();
  const since = rangeStartIso(request.range, now);

  const results: BrowsingDataResult[] = [];
  for (const category of request.categories) {
    const ignoredRange = request.range !== 'todo' && RANGE_UNAWARE_CATEGORIES.has(category);
    try {
      results.push({ category, cleared: true, ignoredRange, ...(await runCategory(category, since, deps)) });
    } catch (error) {
      results.push({ category, cleared: false, ignoredRange, error: toMessage(error) });
    }
  }

  return { range: request.range, results };
}

async function runCategory(
  category: BrowsingDataCategory,
  since: string | null,
  deps: BrowsingDataDeps,
): Promise<{ removed?: number }> {
  switch (category) {
    case 'historial':
      return { removed: await deps.clearHistorySince(since) };
    case 'cookies':
      await deps.clearSiteData();
      return {};
    case 'cache':
      await deps.clearCache();
      return {};
    case 'contrasenas':
      return { removed: await deps.clearPasswords() };
    default:
      return { removed: await deps.clearSitePermissions() };
  }
}

function isCategory(value: unknown): value is BrowsingDataCategory {
  return typeof value === 'string' && (BROWSING_DATA_CATEGORIES as readonly string[]).includes(value);
}

function isRange(value: unknown): value is BrowsingDataRange {
  return typeof value === 'string' && (BROWSING_DATA_RANGES as readonly string[]).includes(value);
}

function toMessage(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).replace(/[\r\n\t]+/g, ' ').slice(0, 200);
}
