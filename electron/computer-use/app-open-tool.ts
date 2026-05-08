import fsSync from 'node:fs';
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

    const launchResult = await launchPathNonBlocking(target.path, {
      requestedPath,
      resolvedPath: target.path,
      resolutionSource: target.source,
      searchedQuery: target.searchedQuery,
    });
    if (!launchResult.success) {
      return { success: false, error: `No pude abrir "${target.path}". Detalle del sistema: ${launchResult.error || 'Error desconocido.'}` };
    }
    return buildLaunchSuccess(target, progressMessages, launchResult);
  } catch (err: any) {
    return { success: false, error: `Excepcion al abrir el archivo o aplicacion: ${err.message}` };
  }
}

async function resolveTarget(requestedPath: string, progressMessages: string[], onProgress?: (message: string) => void): Promise<ResolvedApplicationTarget | OpenFailure> {
  if (looksLikeConcreteApplicationPath(requestedPath)) {
    const directPath = normalizePath(requestedPath);
    if (!fsSync.existsSync(directPath)) {
      return { success: false, error: `No existe ningun archivo o aplicacion en la ruta proporcionada: ${directPath}.` };
    }
    return { path: directPath, source: 'direct', searchedQuery: requestedPath, alternatives: [] };
  }
  const resolved = await resolveApplicationTarget(requestedPath, (message) => {
    progressMessages.push(message);
    onProgress?.(message);
  });
  return resolved || { success: false, error: `No pude localizar una aplicacion instalada que coincida con "${requestedPath}". Intenta con el nombre exacto, una ruta completa o primero usa list_directory/search_files para ubicarla.` };
}

function buildLaunchSuccess(resolvedTarget: ResolvedApplicationTarget, progress: string[], launchResult: any): Record<string, any> {
  const resolvedFrom = resolvedTarget.source === 'direct'
    ? 'ruta directa'
    : resolvedTarget.source === 'app-paths'
      ? 'registro App Paths'
      : resolvedTarget.source === 'where'
        ? 'PATH del sistema'
        : 'busqueda en accesos directos y carpetas comunes';
  return { success: true, message: `Aplicacion o archivo abierto: ${resolvedTarget.path}`, resolvedPath: resolvedTarget.path, resolvedFrom, searchedQuery: resolvedTarget.searchedQuery, alternatives: resolvedTarget.alternatives, progress, session_id: launchResult.session?.id, pid: launchResult.session?.pid, session_status: launchResult.session?.status };
}

function isOpenFailure(value: ResolvedApplicationTarget | OpenFailure): value is OpenFailure {
  return 'success' in value;
}
