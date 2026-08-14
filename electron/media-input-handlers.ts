import { ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import { MediaInputService, sanitizeProviderError } from './media-input/service';
import { denyIfUnauthenticated } from './main/require-auth';

/**
 * Contrato IPC de la subida de medios. Sigue el mismo patron cerrado que el
 * navegador integrado: autenticacion, emisor verificado y error saneado.
 */
export function registerMediaInputHandlers(
  service: MediaInputService,
  getMainWindow: () => BrowserWindow | null,
): void {
  const handle = (
    channel: string,
    operation: (event: IpcMainInvokeEvent, input: any) => unknown | Promise<unknown>,
  ) => {
    ipcMain.handle(channel, async (event, input) => {
      const denied = denyIfUnauthenticated(channel);
      if (denied) return { success: false, error: denied.error };
      const mainWindow = getMainWindow();
      if (!mainWindow || mainWindow.isDestroyed() || event.sender.id !== mainWindow.webContents.id) {
        console.warn(`[Medios] Emisor IPC rechazado en ${channel}.`);
        return { success: false, error: 'sender_denied' };
      }
      try {
        return { success: true, ...(await operation(event, input) as Record<string, unknown>) };
      } catch (error) {
        return { success: false, error: sanitizeProviderError(error) };
      }
    });
  };

  handle('media-input:upload', async (_event, input) => ({
    upload: await service.upload({
      path: readPath(input),
      mimeType: readMimeType(input),
      apiKey: readApiKey(input),
    }),
  }));

  handle('media-input:status', (_event, input) => ({ upload: service.status(readUploadId(input)) }));

  handle('media-input:cancel', (_event, input) => ({ cancelled: service.cancel(readUploadId(input)) }));

  handle('media-input:release', async (_event, input) => ({
    released: await service.release(readUploadId(input), readApiKey(input)),
  }));
}

function readPath(input: unknown): string {
  const value = (input as { path?: unknown })?.path;
  if (typeof value !== 'string' || !value.trim()) throw new Error('Ruta de archivo no valida.');
  return value;
}

function readMimeType(input: unknown): string {
  const value = (input as { mimeType?: unknown })?.mimeType;
  if (typeof value !== 'string' || !value.trim()) throw new Error('Tipo de archivo no valido.');
  return value;
}

function readApiKey(input: unknown): string {
  const value = (input as { apiKey?: unknown })?.apiKey;
  if (typeof value !== 'string' || !value.trim()) throw new Error('Clave del proveedor no configurada.');
  return value;
}

function readUploadId(input: unknown): string {
  const value = (input as { uploadId?: unknown })?.uploadId;
  if (typeof value !== 'string' || !value.trim()) throw new Error('Identificador de subida no valido.');
  return value;
}
