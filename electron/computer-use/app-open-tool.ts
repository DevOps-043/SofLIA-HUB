import { execFile as execFileCb } from 'node:child_process';
import fsSync from 'node:fs';
import { promisify } from 'node:util';
import { shell } from 'electron';
import { normalizePath } from '../utils/file-utils';
import { assertSafeExternalUrl } from './email-security';
import {
  focusExistingApplicationWindow,
  launchPathNonBlocking,
  looksLikeConcreteApplicationPath,
  resolveApplicationTarget,
  type ResolvedApplicationTarget,
} from './app-resolver';

type OpenFailure = { success: false; error: string };

const execFileAsync = promisify(execFileCb);

/** Apps UWP/Microsoft Store: se identifican por ruta shell:AppsFolder\<AppID>. */
function isStartAppsPath(ruta: string): boolean {
  return ruta.toLowerCase().startsWith('shell:appsfolder\\');
}

/** Lanza una app UWP; explorer.exe es la via soportada para shell:AppsFolder. */
async function launchStartAppsTarget(
  ruta: string,
): Promise<{ success: boolean; error?: string; session?: { id?: string; pid?: number; status?: string } }> {
  try {
    await execFileAsync('explorer.exe', [ruta], { timeout: 10000, windowsHide: true });
    return { success: true };
  } catch (err: any) {
    // explorer.exe suele devolver exit code 1 aunque lance correctamente.
    if (typeof err?.code === 'number' && err.code === 1) return { success: true };
    return { success: false, error: err.message };
  }
}

export async function handleOpenUrl(rawUrl: string): Promise<Record<string, any>> {
  try {
    const safeUrl = assertSafeExternalUrl(rawUrl);
    await shell.openExternal(safeUrl);
    return { success: true, message: `URL abierta: ${safeUrl}` };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function handleOpenPath(
  toolName: string,
  args: Record<string, any>,
  onProgress?: (message: string) => void,
): Promise<Record<string, any>> {
  try {
    const requestedPath = typeof args.path === 'string' ? args.path.trim() : '';
    if (!requestedPath) return { success: false, error: 'Debe proporcionar una ruta o nombre de aplicacion valido.' };
    const progressMessages: string[] = [];
    const resolvedTarget = await resolveTarget(requestedPath, progressMessages, onProgress);
    if (isOpenFailure(resolvedTarget)) return resolvedTarget;
    const target = resolvedTarget;

    if (toolName === 'open_application') {
      const existingWindow = await focusExistingApplicationWindow(requestedPath, target.path);
      if (existingWindow) {
        return {
          success: true,
          message: `La aplicacion ya estaba abierta y la traje al frente: ${existingWindow.title || existingWindow.process}`,
          resolvedPath: target.path,
          resolvedFrom: 'ventana existente',
          searchedQuery: target.searchedQuery,
          alternatives: target.alternatives,
          progress: progressMessages,
          pid: existingWindow.pid,
          session_status: 'focused',
        };
      }
    }

    const launchResult = isStartAppsPath(target.path)
      ? await launchStartAppsTarget(target.path)
      : await launchPathNonBlocking(target.path, {
        requestedPath,
        resolvedPath: target.path,
        resolutionSource: target.source,
        searchedQuery: target.searchedQuery,
      });
    if (!launchResult.success) {
      return { success: false, error: `No pude abrir "${target.path}". Detalle del sistema: ${launchResult.error || 'Error desconocido.'}` };
    }

    // Para open_application: esperar y verificar que la ventana realmente apareció
    if (toolName === 'open_application') {
      await new Promise((resolve) => setTimeout(resolve, 1800));
      const windowConfirm = await focusExistingApplicationWindow(requestedPath, target.path);
      if (!windowConfirm) {
        return {
          success: false,
          error: `Lancé "${target.path}" pero la ventana no apareció. Puede haber un problema con la aplicación o requiere permisos adicionales. Intenta de nuevo o verifica que la aplicación esté instalada correctamente.`,
          resolvedPath: target.path,
          session_id: launchResult.session?.id,
        };
      }
      return {
        ...buildLaunchSuccess(target, progressMessages, launchResult),
        window_verified: true,
        window_title: windowConfirm.title,
        pid: windowConfirm.pid,
      };
    }

    return buildLaunchSuccess(target, progressMessages, launchResult);
  } catch (err: any) {
    return { success: false, error: `Excepcion al abrir el archivo o aplicacion: ${err.message}` };
  }
}

async function resolveTarget(requestedPath: string, progressMessages: string[], onProgress?: (message: string) => void): Promise<ResolvedApplicationTarget | OpenFailure> {
  if (isStartAppsPath(requestedPath)) {
    return { path: requestedPath, source: 'start-apps', searchedQuery: requestedPath, alternatives: [] };
  }
  if (looksLikeConcreteApplicationPath(requestedPath)) {
    const directPath = normalizePath(requestedPath);
    if (!fsSync.existsSync(directPath)) {
      return { success: false, error: `No existe ningun archivo o aplicacion en la ruta proporcionada: ${directPath}.` };
    }
    return { path: directPath, source: 'direct', searchedQuery: requestedPath, alternatives: [] };
  }

  // Indice de apps instaladas primero: cataloga los accesos directos del Menu
  // Inicio, que el escaneo en vivo puede no alcanzar (presupuesto de
  // directorios agotado en Program Files).
  const indexed = await lookupInstalledAppsIndex(requestedPath);
  if (indexed) {
    progressMessages.push(`Resuelto via indice de apps instaladas: ${indexed.ruta}`);
    onProgress?.(`Resuelto via indice de apps instaladas: ${indexed.ruta}`);
    return { path: indexed.ruta, source: 'installed-apps-index', searchedQuery: requestedPath, alternatives: [] };
  }

  const resolved = await resolveApplicationTarget(requestedPath, (message) => {
    progressMessages.push(message);
    onProgress?.(message);
  });
  return resolved || { success: false, error: `No pude localizar una aplicacion instalada que coincida con "${requestedPath}". Intenta con el nombre exacto, una ruta completa o primero usa list_directory/search_files para ubicarla.` };
}

async function lookupInstalledAppsIndex(requestedPath: string): Promise<{ nombre: string; ruta: string } | null> {
  try {
    const { findInstalledApp } = await import('../desktop-agent/installed-apps-index');
    const entry = await findInstalledApp(requestedPath, 6 * 60 * 60 * 1000);
    if (!entry) return null;
    // Las rutas shell:AppsFolder (UWP) no existen en el filesystem: son AppIDs.
    if (isStartAppsPath(entry.ruta)) return entry;
    return fsSync.existsSync(entry.ruta) ? entry : null;
  } catch {
    return null;
  }
}

function buildLaunchSuccess(resolvedTarget: ResolvedApplicationTarget, progress: string[], launchResult: any): Record<string, any> {
  const resolvedFrom = resolvedTarget.source === 'direct'
    ? 'ruta directa'
    : resolvedTarget.source === 'app-paths'
      ? 'registro App Paths'
      : resolvedTarget.source === 'where'
        ? 'PATH del sistema'
        : resolvedTarget.source === 'installed-apps-index'
          ? 'indice de apps instaladas'
          : resolvedTarget.source === 'start-apps'
            ? 'apps del Menu Inicio (UWP)'
            : 'busqueda en accesos directos y carpetas comunes';
  return { success: true, message: `Aplicacion o archivo abierto: ${resolvedTarget.path}`, resolvedPath: resolvedTarget.path, resolvedFrom, searchedQuery: resolvedTarget.searchedQuery, alternatives: resolvedTarget.alternatives, progress, session_id: launchResult.session?.id, pid: launchResult.session?.pid, session_status: launchResult.session?.status };
}

function isOpenFailure(value: ResolvedApplicationTarget | OpenFailure): value is OpenFailure {
  return 'success' in value;
}
