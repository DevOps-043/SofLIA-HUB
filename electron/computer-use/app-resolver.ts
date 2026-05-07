/**
 * Resolución de aplicaciones por nombre/alias en Windows.
 *
 * El usuario puede pedir "abre Chrome" o "abre Word" y este módulo se
 * encarga de localizar el ejecutable real entre múltiples fuentes:
 *
 *  1. **Path directo** — si el input ya es una ruta absoluta y existe, se usa
 *  2. **`where.exe`** — comando del sistema que busca en `%PATH%`
 *  3. **Registry App Paths** — `HKLM/HKCU\...\App Paths\<exe>`
 *  4. **Filesystem walk** — recorre Program Files, AppData, Start Menu, etc.
 *
 * Cada fuente devuelve candidatos con score; al final se rankean y se elige
 * el de mayor puntaje. El scorer privilegia binarios en `Program Files`,
 * castiga "Downloads" e instaladores, premia coincidencias exactas de nombre.
 *
 * Una vez resuelta la ruta, también permite enfocar una ventana ya abierta
 * (`focusExistingApplicationWindow`) o lanzar el binario de forma no-bloqueante
 * (`launchPathNonBlocking`).
 */

import { shell } from 'electron';
import { exec } from 'node:child_process';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import util from 'node:util';
import {
  backgroundProcessService,
  type ManagedSessionView,
} from '../background-process-service';
import { normalizePath } from '../utils/file-utils';

const execAsync = util.promisify(exec);

const MAX_APP_SEARCH_RESULTS = 16;
const MAX_APP_SEARCH_DIRS = 2500;

/**
 * Aliases comunes ES/EN para que "calculadora" mapee a `calc.exe`,
 * "blocdenotas" a `notepad.exe`, etc. Si el usuario escribe el nombre exacto
 * del binario, no se necesita alias.
 */
const WINDOWS_APP_ALIASES: Record<string, string[]> = {
  anydesk: ['AnyDesk.exe'],
  calculadora: ['calc.exe'],
  calculator: ['calc.exe'],
  blocdenotas: ['notepad.exe'],
  notepad: ['notepad.exe'],
  explorer: ['explorer.exe'],
  fileexplorer: ['explorer.exe'],
  chrome: ['chrome.exe'],
  edge: ['msedge.exe'],
  brave: ['brave.exe'],
  whatsapp: ['WhatsApp.exe'],
  vscode: ['Code.exe'],
  code: ['Code.exe'],
  visualstudiocode: ['Code.exe'],
  word: ['WINWORD.EXE'],
  excel: ['EXCEL.EXE'],
  powerpoint: ['POWERPNT.EXE'],
  outlook: ['OUTLOOK.EXE'],
  teams: ['Teams.exe', 'ms-teams.exe'],
  zoom: ['Zoom.exe'],
};

export type ResolvedApplicationTarget = {
  path: string;
  source: string;
  score?: number;
  searchedQuery?: string;
  alternatives?: string[];
};

interface ApplicationSearchRoot {
  root: string;
  source: string;
  maxDepth: number;
}

export interface ExistingWindowMatch {
  pid: number;
  process: string;
  title: string;
}

/* ─── Pure helpers ────────────────────────────────────────────────── */

/** Normaliza tokens para comparación tolerante a acentos/caso/espacios. */
function normalizeLookupToken(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function stripLaunchExtension(value: string): string {
  return value.replace(/\.(exe|lnk|appref-ms|cmd|bat|com)$/i, '');
}

function looksLikeConcretePath(value: string): boolean {
  const trimmed = (value || '').trim();
  if (!trimmed) return false;
  return (
    path.isAbsolute(trimmed) ||
    /[\\/]/.test(trimmed) ||
    /\.[a-z0-9]{2,10}$/i.test(path.basename(trimmed))
  );
}

function isLaunchableCandidatePath(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return ['.exe', '.lnk', '.appref-ms', '.cmd', '.bat', '.com'].includes(ext);
}

const SKIP_DIR_NAMES = new Set(['windows', 'winsxs', 'system32', 'syswow64', 'node_modules', '.git']);

function shouldSkipApplicationSearchDirectory(name: string): boolean {
  const lower = name.toLowerCase();
  return lower.startsWith('.') || SKIP_DIR_NAMES.has(lower);
}

/**
 * Asigna puntaje al candidato según qué tan bien matchea las queries y la
 * ubicación del binario. Los modificadores (Program Files +90, Downloads
 * −80, "installer/setup" −180) son heurísticas calibradas empíricamente.
 */
function scoreApplicationCandidate(filePath: string, normalizedQueries: string[]): number {
  const lowerPath = filePath.toLowerCase();
  const baseName = stripLaunchExtension(path.basename(filePath)).toLowerCase();
  const compactBase = normalizeLookupToken(baseName);
  const compactPath = normalizeLookupToken(lowerPath);

  let score = 0;
  for (const query of normalizedQueries) {
    if (!query) continue;
    if (compactBase === query) score = Math.max(score, 220);
    else if (compactBase.startsWith(query)) score = Math.max(score, 180);
    else if (compactBase.includes(query)) score = Math.max(score, 145);
    else if (compactPath.includes(query)) score = Math.max(score, 70);
  }

  if (score === 0) return 0;

  if (
    /[\\/]program files( \(x86\))?[\\/]/i.test(lowerPath) ||
    /[\\/]appdata[\\/]local[\\/]programs[\\/]/i.test(lowerPath)
  ) {
    score += 90;
  }
  if (/[\\/]start menu[\\/]programs[\\/]/i.test(lowerPath)) score += 70;
  if (lowerPath.includes('\\windowsapps\\')) score += 55;
  if (lowerPath.includes('\\downloads\\')) score -= 80;
  if (/(setup|installer|install|update|updater|uninstall|bootstrap|helper)/i.test(lowerPath)) {
    score -= 180;
  }

  const ext = path.extname(lowerPath).toLowerCase();
  if (ext === '.exe') score += 25;
  if (ext === '.lnk' || ext === '.appref-ms') score += 10;

  return score;
}

/**
 * A partir del input crudo, genera variantes para buscar:
 * - El nombre tal cual
 * - Con espacios en lugar de `-_`
 * - Sin espacios
 * - Con `.exe` al final
 * - Aliases registrados
 */
function buildApplicationQueryVariants(rawTarget: string): string[] {
  const base = stripLaunchExtension(path.basename((rawTarget || '').trim()));
  if (!base) return [];

  const variants = new Set<string>();
  variants.add(base);
  variants.add(base.replace(/[-_]+/g, ' '));
  variants.add(base.replace(/\s+/g, ''));
  variants.add(`${base}.exe`);

  const aliasKey = normalizeLookupToken(base);
  for (const alias of WINDOWS_APP_ALIASES[aliasKey] || []) {
    variants.add(alias);
  }

  return Array.from(variants).map((value) => value.trim()).filter(Boolean);
}

function getWindowsApplicationSearchRoots(): ApplicationSearchRoot[] {
  // En orden de prioridad: programas instalados → start menu → desktop/downloads.
  const envCandidates: Array<ApplicationSearchRoot | null> = [
    process.env.LOCALAPPDATA
      ? { root: path.join(process.env.LOCALAPPDATA, 'Programs'), source: 'local-programs', maxDepth: 4 }
      : null,
    process.env.ProgramFiles
      ? { root: process.env.ProgramFiles, source: 'program-files', maxDepth: 4 }
      : null,
    process.env['ProgramFiles(x86)']
      ? { root: process.env['ProgramFiles(x86)'], source: 'program-files-x86', maxDepth: 4 }
      : null,
    process.env.LOCALAPPDATA
      ? {
          root: path.join(process.env.LOCALAPPDATA, 'Microsoft', 'WindowsApps'),
          source: 'windows-apps',
          maxDepth: 2,
        }
      : null,
    process.env.APPDATA
      ? {
          root: path.join(process.env.APPDATA, 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
          source: 'start-menu-user',
          maxDepth: 3,
        }
      : null,
    process.env.ProgramData
      ? {
          root: path.join(process.env.ProgramData, 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
          source: 'start-menu-machine',
          maxDepth: 3,
        }
      : null,
    { root: path.join(os.homedir(), 'Desktop'), source: 'desktop', maxDepth: 2 },
    { root: path.join(os.homedir(), 'Downloads'), source: 'downloads', maxDepth: 2 },
  ];

  const seen = new Set<string>();
  const roots: ApplicationSearchRoot[] = [];
  for (const candidate of envCandidates) {
    if (!candidate) continue;
    const normalized = path.normalize(candidate.root);
    if (seen.has(normalized.toLowerCase())) continue;
    seen.add(normalized.toLowerCase());
    try {
      if (fsSync.existsSync(normalized)) {
        roots.push({ ...candidate, root: normalized });
      }
    } catch {
      // Ignore inaccessible roots.
    }
  }
  return roots;
}

/* ─── Resolution sources ──────────────────────────────────────────── */

/** Usa `where.exe` (búsqueda en `%PATH%`). Score alto: el sistema "ya sabe" dónde están. */
async function collectWhereMatches(queryVariants: string[]): Promise<ResolvedApplicationTarget[]> {
  const results = new Map<string, ResolvedApplicationTarget>();
  for (const rawVariant of queryVariants.slice(0, 8)) {
    const baseVariant = stripLaunchExtension(path.basename(rawVariant));
    const attempts = new Set<string>([rawVariant, baseVariant, `${baseVariant}.exe`]);

    for (const attempt of attempts) {
      const command = attempt.trim();
      if (!command) continue;
      try {
        const { stdout } = await execAsync(`where.exe "${command.replace(/"/g, '\\"')}"`, {
          timeout: 1500,
          windowsHide: true,
          maxBuffer: 1024 * 128,
        });
        for (const line of (stdout || '').split(/\r?\n/)) {
          const candidate = line.trim();
          if (!candidate || !fsSync.existsSync(candidate)) continue;
          const key = candidate.toLowerCase();
          if (!results.has(key)) {
            results.set(key, { path: candidate, source: 'where', score: 260 });
          }
        }
      } catch {
        // No match en esta variante; continúa con la siguiente.
      }
    }
  }
  return Array.from(results.values());
}

/**
 * Consulta el registry de Windows en `App Paths` — fuente más confiable
 * que `where.exe` para apps que no están en `%PATH%` (la mayoría).
 */
async function collectRegistryMatches(queryVariants: string[]): Promise<ResolvedApplicationTarget[]> {
  const results = new Map<string, ResolvedApplicationTarget>();
  const exeNames = Array.from(
    new Set(
      queryVariants
        .map((variant) => {
          const base = stripLaunchExtension(path.basename(variant.trim()));
          return base ? `${base}.exe` : '';
        })
        .filter(Boolean),
    ),
  );

  for (const exeName of exeNames.slice(0, 8)) {
    for (const hive of ['HKLM', 'HKCU']) {
      const registryKey = `${hive}\\Software\\Microsoft\\Windows\\CurrentVersion\\App Paths\\${exeName}`;
      try {
        const { stdout } = await execAsync(`reg query "${registryKey}" /ve`, {
          timeout: 2000,
          windowsHide: true,
          maxBuffer: 1024 * 128,
        });
        const match = (stdout || '').match(/REG_\w+\s+([^\r\n]+)\s*$/m);
        const candidate = match?.[1]?.trim();
        if (!candidate || !fsSync.existsSync(candidate)) continue;
        const key = candidate.toLowerCase();
        if (!results.has(key)) {
          results.set(key, { path: candidate, source: 'app-paths', score: 280 });
        }
      } catch {
        // Falta la entrada en este hive; intenta el otro.
      }
    }
  }

  return Array.from(results.values());
}

/**
 * BFS por las raíces conocidas (Program Files, Start Menu, AppData).
 * Limita scanned dirs para no quedarse buscando en árboles enormes.
 */
async function searchWindowsApplicationRoots(
  queryVariants: string[],
): Promise<ResolvedApplicationTarget[]> {
  const normalizedQueries = queryVariants
    .map((variant) => normalizeLookupToken(stripLaunchExtension(variant)))
    .filter(Boolean);
  const matches = new Map<string, ResolvedApplicationTarget>();
  let scannedDirs = 0;

  for (const searchRoot of getWindowsApplicationSearchRoots()) {
    const queue: Array<{ dir: string; depth: number }> = [{ dir: searchRoot.root, depth: 0 }];

    while (queue.length > 0 && matches.size < MAX_APP_SEARCH_RESULTS && scannedDirs < MAX_APP_SEARCH_DIRS) {
      const current = queue.shift();
      if (!current) break;
      scannedDirs += 1;

      let entries: fsSync.Dirent[] = [];
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

        const score = scoreApplicationCandidate(fullPath, normalizedQueries);
        if (score <= 0) continue;

        const key = fullPath.toLowerCase();
        const existing = matches.get(key);
        if (!existing || score > (existing.score ?? 0)) {
          matches.set(key, { path: fullPath, source: searchRoot.source, score });
        }
      }
    }
  }

  return Array.from(matches.values()).sort((a, b) => {
    const byScore = (b.score ?? 0) - (a.score ?? 0);
    if (byScore !== 0) return byScore;
    return a.path.length - b.path.length;
  });
}

/**
 * Orquestador. Devuelve el mejor candidato + alternatives (top 4 siguientes).
 * Si la query parece ya una ruta absoluta y existe, retorna directo sin
 * tocar where/registry/filesystem.
 */
export async function resolveApplicationTarget(
  target: string,
  onProgress?: (message: string) => void,
): Promise<ResolvedApplicationTarget | null> {
  const rawTarget = (target || '').trim();
  if (!rawTarget) return null;

  const directPath = normalizePath(rawTarget);
  if (looksLikeConcretePath(rawTarget) && fsSync.existsSync(directPath)) {
    return { path: directPath, source: 'direct', searchedQuery: rawTarget };
  }

  if (process.platform !== 'win32') {
    return null;
  }

  const query = stripLaunchExtension(path.basename(rawTarget));
  const queryVariants = buildApplicationQueryVariants(query);
  if (queryVariants.length === 0) return null;

  const candidates = new Map<string, ResolvedApplicationTarget>();
  const addCandidates = (items: ResolvedApplicationTarget[]) => {
    for (const item of items) {
      if (!item?.path || !fsSync.existsSync(item.path)) continue;
      const key = item.path.toLowerCase();
      const existing = candidates.get(key);
      if (!existing || (item.score ?? 0) > (existing.score ?? 0)) {
        candidates.set(key, { ...item, searchedQuery: query });
      }
    }
  };

  onProgress?.(`Buscando "${query}" en alias de Windows y aplicaciones instaladas...`);
  addCandidates(await collectWhereMatches(queryVariants));
  addCandidates(await collectRegistryMatches(queryVariants));

  if (candidates.size < 3) {
    onProgress?.(`Explorando ubicaciones comunes de programas para "${query}"...`);
    addCandidates(await searchWindowsApplicationRoots(queryVariants));
  }

  const ranked = Array.from(candidates.values()).sort((a, b) => {
    const byScore = (b.score ?? 0) - (a.score ?? 0);
    if (byScore !== 0) return byScore;
    return a.path.length - b.path.length;
  });

  if (ranked.length === 0) return null;

  return {
    ...ranked[0],
    alternatives: ranked.slice(1, 5).map((candidate) => candidate.path),
  };
}

/* ─── Window focusing & launching ─────────────────────────────────── */

export function looksLikeConcreteApplicationPath(value: string): boolean {
  return looksLikeConcretePath(value);
}

function escapePowerShellSingleQuoted(value: string): string {
  return value.replace(/'/g, "''");
}

function buildWindowSearchTokens(requestedPath: string, resolvedPath: string): string[] {
  const candidates = new Set<string>();
  const requestedBase = stripLaunchExtension(path.basename((requestedPath || '').trim()));
  const resolvedBase = stripLaunchExtension(path.basename((resolvedPath || '').trim()));

  for (const candidate of [requestedBase, resolvedBase, requestedPath, resolvedPath]) {
    const trimmed = String(candidate || '').trim();
    if (!trimmed) continue;
    candidates.add(trimmed);
    candidates.add(trimmed.replace(/[-_]+/g, ' '));
  }

  return Array.from(candidates)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2)
    .slice(0, 8);
}

/**
 * Si la app ya está abierta, en lugar de lanzarla de nuevo (que crea otra
 * instancia o sufre el "already running" de Electron), traemos la ventana
 * existente al frente. Implementado con PowerShell + user32 para SetForegroundWindow.
 */
export async function focusExistingApplicationWindow(
  requestedPath: string,
  resolvedPath: string,
): Promise<ExistingWindowMatch | null> {
  if (process.platform !== 'win32') return null;

  const tokens = buildWindowSearchTokens(requestedPath, resolvedPath);
  if (!tokens.length) return null;

  const tokenConditions = tokens
    .map((token) => {
      const safe = escapePowerShellSingleQuoted(token);
      return `$_.ProcessName -like '*${safe}*' -or $_.MainWindowTitle -like '*${safe}*'`;
    })
    .join(' -or ');

  if (!tokenConditions) return null;

  const script = `
Add-Type -Name Win32 -Namespace W -MemberDefinition '
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
'
$proc = Get-Process | Where-Object { $_.MainWindowHandle -ne 0 -and (${tokenConditions}) } | Sort-Object StartTime -Descending | Select-Object -First 1
if ($proc) {
  [W.Win32]::ShowWindow($proc.MainWindowHandle, 9) | Out-Null
  [W.Win32]::SetForegroundWindow($proc.MainWindowHandle) | Out-Null
  @{ pid = $proc.Id; process = $proc.ProcessName; title = $proc.MainWindowTitle } | ConvertTo-Json -Compress
}
`;

  try {
    const { stdout } = await execAsync(
      `powershell -NoProfile -Command "${script.replace(/\n/g, '; ').replace(/"/g, '\\"')}"`,
      { timeout: 4000, windowsHide: true, maxBuffer: 1024 * 128 },
    );
    const trimmed = (stdout || '').trim();
    if (!trimmed) return null;
    const parsed = JSON.parse(trimmed);
    if (!parsed?.pid) return null;
    return {
      pid: Number(parsed.pid) || 0,
      process: String(parsed.process || ''),
      title: String(parsed.title || ''),
    };
  } catch {
    return null;
  }
}

/**
 * Lanza un binario sin bloquear el proceso main. En Windows usa el
 * `BackgroundProcessService` para tener tracking de la sesión; en otros
 * sistemas delega a `shell.openPath`.
 */
export async function launchPathNonBlocking(
  resolvedPath: string,
  metadata?: Record<string, any>,
): Promise<{ success: boolean; error?: string; session?: ManagedSessionView | null }> {
  const normalized = normalizePath(resolvedPath);

  if (process.platform === 'win32') {
    try {
      const session = await backgroundProcessService.launchApplication({
        targetPath: normalized,
        title: `Aplicacion: ${path.basename(normalized)}`,
        metadata,
      });
      if (session.status === 'failed') {
        return { success: false, error: session.lastError || 'No se pudo iniciar el proceso.', session };
      }
      return { success: true, session };
    } catch (err: any) {
      return {
        success: false,
        error: err?.stderr?.trim() || err?.stdout?.trim() || err?.message || 'No se pudo iniciar el proceso.',
      };
    }
  }

  try {
    const result = await shell.openPath(normalized);
    if (result) {
      return { success: false, error: result };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'No se pudo abrir el elemento.' };
  }
}
