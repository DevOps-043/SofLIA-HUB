import { handleOpenPath, handleOpenUrl } from '../computer-use/app-open-tool';
import { DeterministicActionError } from './action-errors';

export type DeterministicActionResult = {
  success: boolean;
  message: string;
  windowTitle?: string;
};

/**
 * Acciones deterministas del agente de escritorio: en lugar de buscar iconos
 * visualmente, resuelven y lanzan aplicaciones/URLs con la infraestructura de
 * computer-use (indice de apps instaladas, registro, PATH, accesos directos,
 * verificacion de ventana). En fallo lanzan Error con mensaje en espanol para
 * que el runner lo registre en el historial y el modelo pueda reaccionar.
 */
export async function openApplicationDeterministic(appName: string): Promise<DeterministicActionResult> {
  const result = await handleOpenPath('open_application', { path: appName });
  if (!result.success) {
    // "No localizada" es determinista: reintentar con el mismo nombre no ayuda.
    throw new DeterministicActionError(result.error || `No pude abrir la aplicacion "${appName}".`);
  }
  return {
    success: true,
    message: String(result.message || `Aplicacion abierta: ${appName}`),
    windowTitle: typeof result.window_title === 'string' ? result.window_title : undefined,
  };
}

export async function openUrlDeterministic(url: string): Promise<DeterministicActionResult> {
  const result = await handleOpenUrl(url);
  if (!result.success) {
    throw new DeterministicActionError(result.error || `No pude abrir la URL "${url}".`);
  }
  return { success: true, message: String(result.message || `URL abierta: ${url}`) };
}
