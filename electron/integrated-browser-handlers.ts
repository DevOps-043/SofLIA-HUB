import { ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import type { IntegratedBrowserService } from './integrated-browser';
import { denyIfUnauthenticated } from './main/require-auth';

export function registerIntegratedBrowserHandlers(
  service: IntegratedBrowserService,
  getMainWindow: () => BrowserWindow | null,
): void {
  const handle = (
    channel: string,
    operation: (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown | Promise<unknown>,
  ) => {
    ipcMain.handle(channel, async (event, ...args) => {
      const denied = denyIfUnauthenticated(channel);
      if (denied) return { success: false, error: denied.error };
      const mainWindow = getMainWindow();
      if (!mainWindow || mainWindow.isDestroyed() || event.sender.id !== mainWindow.webContents.id) {
        console.warn(`[Navegador] Emisor IPC rechazado en ${channel}.`);
        return { success: false, error: 'sender_denied' };
      }
      try {
        const state = await operation(event, ...args);
        return { success: true, state };
      } catch (error) {
        return { success: false, error: safeBrowserError(error) };
      }
    });
  };

  handle('integrated-browser:get-state', () => service.getState());
  handle('integrated-browser:open', (_event, input) => {
    const url = readOptionalUrl(input);
    return service.open(url);
  });
  handle('integrated-browser:navigate', (_event, input) => service.navigate(readTarget(input)));
  handle('integrated-browser:go-back', () => service.goBack());
  handle('integrated-browser:go-forward', () => service.goForward());
  handle('integrated-browser:reload', () => service.reload());
  handle('integrated-browser:stop', () => service.stop());
  handle('integrated-browser:focus', () => service.focus());
  handle('integrated-browser:set-viewport', (_event, viewport) => service.setViewport(viewport));
  handle('integrated-browser:hide', () => service.hide());
}

function readOptionalUrl(input: unknown): string | undefined {
  if (input === undefined || input === null) return undefined;
  if (!input || typeof input !== 'object') throw new Error('Payload de apertura invalido.');
  const url = (input as { url?: unknown }).url;
  if (url === undefined) return undefined;
  if (typeof url !== 'string') throw new Error('La URL debe ser texto.');
  return url;
}

function readTarget(input: unknown): string {
  if (!input || typeof input !== 'object') throw new Error('Payload de navegacion invalido.');
  const target = (input as { target?: unknown }).target;
  if (typeof target !== 'string') throw new Error('La direccion debe ser texto.');
  return target;
}

function safeBrowserError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/[\r\n\t]+/g, ' ').trim().slice(0, 240) || 'Error del navegador integrado.';
}
