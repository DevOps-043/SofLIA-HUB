import { ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import type { DesktopContextService } from './desktop-context/service';
import { isDesktopContextEnabled, isValidCandidateId } from './desktop-context/types';
import { denyIfUnauthenticated } from './main/require-auth';
import { onAuthStateChange } from './main/auth-state';
import { trustedAppCaller } from './ipc/caller-authorization';

/** El inventario y sus lecturas pertenecen al contexto que los solicitó. */
export function registerDesktopContextHandlers(service: DesktopContextService, getMainWindow: () => BrowserWindow | null) {
  if (!isDesktopContextEnabled()) return;
  const unsubscribe = onAuthStateChange(() => service.clearInventory());
  const handle = (channel: string, count: number, operation: (context: ReturnType<typeof trustedAppCaller>, args: unknown[]) => Promise<object>) => {
    ipcMain.handle(channel, async (event: IpcMainInvokeEvent, ...args: unknown[]) => {
      const denied = denyIfUnauthenticated(channel); if (denied) return { success: false, error: denied.error };
      const main = getMainWindow(); if (!main || main.isDestroyed() || event.sender !== main.webContents) return { success: false, error: 'sender_denied' };
      const context = trustedAppCaller(event, () => [getMainWindow()]);
      try {
        context.assert(); if (args.length !== count) throw new Error('input_invalid');
        const result = await operation(context, args); context.assert(); return { success: true, ...result };
      } catch {
        return { success: false, error: safeDesktopContextError('No se pudo leer el contexto con la sesión y política vigentes. No se adjuntó contenido sin confirmar.') };
      } finally { context.dispose(); }
    });
  };
  handle('desktop-context:list-apps', 0, async context => ({ inventory: await service.listApps({ assertCurrent: context.assert, signal: context.signal }) }));
  handle('desktop-context:capture-app', 1, async (context, [input]) => {
    if (!input || typeof input !== 'object' || Object.keys(input).length !== 1 || !Object.prototype.hasOwnProperty.call(input, 'appId')) throw new Error('input_invalid');
    const id = (input as { appId: unknown }).appId; if (!isValidCandidateId(id)) throw new Error('input_invalid');
    return { attachment: await service.captureApp(id, { assertCurrent: context.assert, signal: context.signal }) };
  });
  return { dispose: () => { unsubscribe(); service.clearInventory(); } };
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

