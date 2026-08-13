import { ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import type { DesktopContextService } from './desktop-context/service';
import { isDesktopContextEnabled } from './desktop-context/types';
import { denyIfUnauthenticated } from './main/require-auth';

/**
 * Canales del contexto de aplicaciones de escritorio.
 *
 * Con la capacidad desactivada los handlers NO se registran: el renderer ve la
 * API ausente y oculta la entrada del menu, sin rutas muertas en main.
 */
export function registerDesktopContextHandlers(
  service: DesktopContextService,
  getMainWindow: () => BrowserWindow | null,
): void {
  if (!isDesktopContextEnabled()) {
    console.warn('[ContextoEscritorio] Capacidad desactivada por SOFLIA_DISABLE_DESKTOP_CONTEXT=1.');
    return;
  }

  const handle = (
    channel: string,
    operation: (event: IpcMainInvokeEvent, input: unknown) => Promise<Record<string, unknown>>,
  ) => {
    ipcMain.handle(channel, async (event, input) => {
      const denied = denyIfUnauthenticated(channel);
      if (denied) return { success: false, error: denied.error };
      const mainWindow = getMainWindow();
      if (!mainWindow || mainWindow.isDestroyed() || event.sender.id !== mainWindow.webContents.id) {
        console.warn(`[ContextoEscritorio] Emisor IPC rechazado en ${channel}.`);
        return { success: false, error: 'sender_denied' };
      }
      try {
        return { success: true, ...(await operation(event, input)) };
      } catch (error) {
        return { success: false, error: safeDesktopContextError(error) };
      }
    });
  };

  handle('desktop-context:list-apps', async () => ({ inventory: await service.listApps() }));
  handle('desktop-context:capture-app', async (_event, input) => ({
    attachment: await service.captureApp(readAppId(input)),
  }));
}

function readAppId(input: unknown): unknown {
  return (input as { appId?: unknown } | null)?.appId;
}

/**
 * Mensaje apto para el renderer: una linea, acotado y sin rutas del disco ni
 * trazas internas. Una ruta de usuario en un toast es una fuga innecesaria.
 */
export function safeDesktopContextError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/[A-Za-z]:\\[^\s"']+/g, '<ruta>')
    .replace(/\/(?:[\w.-]+\/){2,}[\w.-]+/g, '<ruta>')
    .replace(/[\r\n\t]+/g, ' ')
    .trim()
    .slice(0, 240) || 'No se pudo leer el contexto de escritorio.';
}
