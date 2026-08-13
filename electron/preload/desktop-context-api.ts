import type { PreloadBridge, SafeIpc } from './types';

/**
 * Contexto de aplicaciones de escritorio: el chat lista las ventanas abiertas y
 * extrae el contenido de las que el usuario marca. Solo dos operaciones, ambas
 * de lectura.
 */
export function exposeDesktopContextApi(bridge: PreloadBridge, ipc: SafeIpc): void {
  const { safeInvoke } = ipc;
  bridge.exposeInMainWorld('desktopContext', {
    listApps: () => safeInvoke('desktop-context:list-apps'),
    captureApp: (appId: string) => safeInvoke('desktop-context:capture-app', { appId }),
  });
}
