import { execFile as execFileCb } from 'node:child_process';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { app as electronApp } from 'electron';
import {
  isLaunchableCandidatePath,
  normalizeLookupToken,
  shouldSkipApplicationSearchDirectory,
  stripLaunchExtension,
} from '../computer-use/app-resolver/path-helpers';
import { getWindowsApplicationSearchRoots } from '../computer-use/app-resolver/search-roots';

export type InstalledAppEntry = { nombre: string; ruta: string };

type InstalledAppsIndexFile = {
  version?: number;
  generadoEn: number;
  apps: InstalledAppEntry[];
};

/** Subir al cambiar el formato/fuentes del indice: invalida indices persistidos viejos. */
const INDEX_VERSION = 2;

/** Fuentes que catalogan lo que el usuario ve como "apps instaladas". */
const INDEX_SOURCES = new Set(['start-menu-user', 'start-menu-machine', 'local-programs']);
const MAX_INDEX_DIRS = 1500;
const MAX_INDEX_APPS = 300;

/** Prefijo de las apps UWP/Microsoft Store; se lanzan via explorer.exe. */
export const START_APPS_SHELL_PREFIX = 'shell:AppsFolder\\';

export function isStartAppsShellPath(ruta: string): boolean {
  return ruta.toLowerCase().startsWith(START_APPS_SHELL_PREFIX.toLowerCase());
}

const execFileAsync = promisify(execFileCb);

let cachedIndex: InstalledAppsIndexFile | null = null;
let refreshInFlight: Promise<InstalledAppsIndexFile> | null = null;

function getIndexPath(): string {
  try {
    return path.join(electronApp.getPath('userData'), 'installed-apps-index.json');
  } catch {
    return path.join(process.cwd(), 'installed-apps-index.json');
  }
}

/**
 * Indice cacheado de aplicaciones instaladas (patron de path-memory-service):
 * cataloga accesos directos del Menu Inicio y programas locales para que el
 * planner sepa que apps existen SIN buscar iconos visualmente. El indice solo
 * alimenta el prompt; open_application usa resolveApplicationTarget en vivo
 * como fuente de verdad.
 */
export async function getInstalledAppsIndex(ttlMs: number): Promise<InstalledAppEntry[]> {
  const now = Date.now();
  if (cachedIndex && now - cachedIndex.generadoEn < ttlMs) return cachedIndex.apps;

  const persisted = cachedIndex ?? loadPersistedIndex();
  if (persisted && now - persisted.generadoEn < ttlMs) {
    cachedIndex = persisted;
    return persisted.apps;
  }

  // Refresco perezoso: si ya hay un escaneo en curso, reutilizarlo; si hay un
  // indice viejo, devolverlo de inmediato y refrescar en segundo plano.
  if (!refreshInFlight) {
    refreshInFlight = rebuildIndex().finally(() => { refreshInFlight = null; });
  }
  if (persisted) {
    cachedIndex = persisted;
    return persisted.apps;
  }
  const fresh = await refreshInFlight;
  return fresh.apps;
}

/**
 * Busca una app en el indice por nombre (normalizado sin acentos ni simbolos).
 * Prioriza coincidencia exacta; si no, la unica entrada que contenga el token.
 * Devuelve null ante ambiguedad para que decida el resolver en vivo.
 */
export async function findInstalledApp(nombre: string, ttlMs: number): Promise<InstalledAppEntry | null> {
  const token = normalizeLookupToken(stripLaunchExtension(nombre));
  if (!token) return null;
  const apps = await getInstalledAppsIndex(ttlMs);

  const exact = apps.find((app) => normalizeLookupToken(app.nombre) === token);
  if (exact) return exact;

  const partial = apps.filter((app) => {
    const appToken = normalizeLookupToken(app.nombre);
    return appToken.includes(token) || token.includes(appToken);
  });
  return partial.length === 1 ? partial[0] : null;
}

/** Solo para tests: descarta el estado en memoria. */
export function resetInstalledAppsIndexCache(): void {
  cachedIndex = null;
  refreshInFlight = null;
}

function loadPersistedIndex(): InstalledAppsIndexFile | null {
  try {
    const indexPath = getIndexPath();
    if (!fsSync.existsSync(indexPath)) return null;
    const parsed = JSON.parse(fsSync.readFileSync(indexPath, 'utf-8')) as InstalledAppsIndexFile;
    if (!Array.isArray(parsed.apps) || typeof parsed.generadoEn !== 'number') return null;
    if (parsed.version !== INDEX_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function rebuildIndex(): Promise<InstalledAppsIndexFile> {
  const apps = await scanInstalledApps();
  const index: InstalledAppsIndexFile = { version: INDEX_VERSION, generadoEn: Date.now(), apps };
  cachedIndex = index;
  try {
    await fs.writeFile(getIndexPath(), JSON.stringify(index, null, 2), 'utf-8');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn('[DesktopAgent] No se pudo persistir el indice de apps instaladas:', message);
  }
  console.log(`[DesktopAgent] Indice de apps instaladas actualizado: ${apps.length} entradas.`);
  return index;
}

async function scanInstalledApps(): Promise<InstalledAppEntry[]> {
  const roots = getWindowsApplicationSearchRoots().filter((root) => INDEX_SOURCES.has(root.source));
  const byName = new Map<string, InstalledAppEntry>();
  let scannedDirs = 0;
  // Las apps UWP/Store (p.ej. Minecraft Launcher) NO tienen .lnk en el Menu
  // Inicio: solo aparecen via Get-StartApps. Se agregan sin pisar entradas
  // win32 existentes (los .lnk son mas directos de lanzar).
  const uwpApps = await scanStartApps();

  for (const searchRoot of roots) {
    const queue: Array<{ dir: string; depth: number }> = [{ dir: searchRoot.root, depth: 0 }];
    while (queue.length > 0 && byName.size < MAX_INDEX_APPS && scannedDirs < MAX_INDEX_DIRS) {
      const current = queue.shift();
      if (!current) break;
      scannedDirs += 1;

      let entries: Array<{ name: string; isDirectory(): boolean }> = [];
      try {
        entries = await fs.readdir(current.dir, { withFileTypes: true });
      } catch {
        continue;
      }

      for (const entry of entries) {
        const fullPath = path.join(current.dir, entry.name);
        if (entry.isDirectory()) {
          if (current.depth < searchRoot.maxDepth && !shouldSkipApplicationSearchDirectory(entry.name)) {
            queue.push({ dir: fullPath, depth: current.depth + 1 });
          }
          continue;
        }
        if (!isLaunchableCandidatePath(fullPath)) continue;
        const nombre = stripLaunchExtension(entry.name);
        if (!nombre || byName.has(nombre.toLowerCase())) continue;
        byName.set(nombre.toLowerCase(), { nombre, ruta: fullPath });
      }
    }
  }

  for (const app of uwpApps) {
    const key = app.nombre.toLowerCase();
    if (!key || byName.has(key) || byName.size >= MAX_INDEX_APPS) continue;
    byName.set(key, app);
  }

  return Array.from(byName.values()).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

/** Enumera TODAS las apps del Menu Inicio (win32 + UWP) via Get-StartApps. */
async function scanStartApps(): Promise<InstalledAppEntry[]> {
  if (process.platform !== 'win32') return [];
  try {
    const script = 'Get-StartApps | Select-Object Name, AppID | ConvertTo-Json -Compress';
    const encoded = Buffer.from(script, 'utf16le').toString('base64');
    const { stdout } = await execFileAsync(
      'powershell',
      ['-NoProfile', '-EncodedCommand', encoded],
      { timeout: 15000, windowsHide: true, maxBuffer: 4 * 1024 * 1024 },
    );
    const parsed = JSON.parse(stdout.trim() || '[]') as Array<{ Name?: string; AppID?: string }> | { Name?: string; AppID?: string };
    const entries = Array.isArray(parsed) ? parsed : [parsed];
    return entries
      .filter((entry) => entry?.Name && entry?.AppID)
      .map((entry) => ({ nombre: String(entry.Name), ruta: `${START_APPS_SHELL_PREFIX}${String(entry.AppID)}` }));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn('[DesktopAgent] Get-StartApps no disponible; el indice solo tendra accesos directos:', message);
    return [];
  }
}
