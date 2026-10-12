import { ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import { MediaInputService, sanitizeProviderError } from './media-input/service';
import { denyIfUnauthenticated } from './main/require-auth';
import { getAuthState, onAuthStateChange } from './main/auth-state';

/**
 * Contrato IPC de la subida de medios. Sigue el mismo patron cerrado que el
 * navegador integrado: autenticacion, emisor verificado y error saneado.
 */
export function registerMediaInputHandlers(
  service: MediaInputService,
  getMainWindow: () => BrowserWindow | null,
): void {
  let revision = 0;
  const owners = new Map<string, string>();
  onAuthStateChange(() => { revision++; owners.clear(); service.invalidateSession(); });
  const handle = (
    channel: string,
    operation: (event: IpcMainInvokeEvent, input: any, owner: string, guard: () => void) => unknown | Promise<unknown>,
  ) => {
    ipcMain.handle(channel, async (event, input) => {
      const denied = denyIfUnauthenticated(channel);
      if (denied) return { success: false, error: denied.error };
      const mainWindow = getMainWindow();
      if (!mainWindow || mainWindow.isDestroyed() || event.sender.id !== mainWindow.webContents.id
        || !event.senderFrame || event.senderFrame !== mainWindow.webContents.mainFrame) {
        console.warn(`[Medios] Emisor IPC rechazado en ${channel}.`);
        return { success: false, error: 'sender_denied' };
      }
      const startedRevision = revision;
      const owner = getAuthState().userId;
      const guard = () => {
        if (!owner || startedRevision !== revision || !getAuthState().authenticated || getAuthState().userId !== owner
          || mainWindow.isDestroyed() || getMainWindow() !== mainWindow || event.senderFrame !== mainWindow.webContents.mainFrame) {
          throw new Error('La sesión de medios cambió.');
        }
      };
      try {
        guard();
        const result = await operation(event, input, owner!, guard);
        guard();
        return { success: true, ...(result as Record<string, unknown>) };
      } catch (error) {
        return { success: false, error: sanitizeProviderError(error) };
      }
    });
  };

  handle('media-input:upload', async (_event, input, owner, guard) => {
    const upload = await service.upload({
      path: readPath(input),
      mimeType: readMimeType(input),
      apiKey: readApiKey(input),
    }, guard);
    guard();
    owners.set(upload.uploadId, owner);
    return { upload };
  });

  const ownedId = (input: unknown, owner: string) => {
    const id = readUploadId(input);
    if (owners.get(id) !== owner) throw new Error('La subida no pertenece a la sesión actual.');
    return id;
  };
  handle('media-input:status', (_event, input, owner) => ({ upload: service.status(ownedId(input, owner)) }));

  handle('media-input:cancel', (_event, input, owner) => ({ cancelled: service.cancel(ownedId(input, owner)) }));

  handle('media-input:release', async (_event, input, owner) => ({
    released: await service.release(ownedId(input, owner), readApiKey(input)),
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
