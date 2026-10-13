import { ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import { getAuthState, onAuthStateChange } from '../main/auth-state';
import { StudioCaptureService } from './service';
import { studioCaptureActivateSchema, studioCaptureReleaseSchema, type StudioCaptureResult } from '../../src/shared/studio-capture';

let owner: BrowserWindow | null = null;
let service: StudioCaptureService | null = null;
let registered = false;
let dispose: (() => void) | null = null;
function authorized(event: IpcMainInvokeEvent): boolean {
  return !!owner && !owner.isDestroyed() && event.sender === owner.webContents && event.senderFrame === owner.webContents.mainFrame && getAuthState().authenticated;
}
export function configureStudioCapture(window: BrowserWindow): void {
  if (owner === window) return;
  dispose?.(); service?.clear();
  owner = window;
  service = new StudioCaptureService(window);
  const clear = () => service?.clear();
  const navigation = (_event: unknown, _url: string, _inPlace: boolean, mainFrame: boolean) => { if (mainFrame) clear(); };
  const auth = onAuthStateChange(clear);
  window.on('closed', clear);
  window.webContents.on('did-start-navigation', navigation);
  dispose = () => { auth(); window.removeListener('closed', clear); window.webContents.removeListener('did-start-navigation', navigation); };
  if (registered) return;
  registered = true;
  ipcMain.handle('studio-capture:choose', async (event, ...args): Promise<StudioCaptureResult> => {
    if (!authorized(event) || args.length) return { success: false, error: 'No tienes acceso a las fuentes del estudio.' };
    const current = service!;
    const actor = getAuthState().userId;
    try { return { success: true, binding: await current.choose(() => service === current && authorized(event) && getAuthState().userId === actor) }; }
    catch { return { success: false, error: 'No pudimos vincular esta fuente. Cierra el selector anterior o quita una escena y vuelve a intentar.' }; }
  });
  ipcMain.handle('studio-capture:activate', async (event, payload: unknown) => {
    const input = studioCaptureActivateSchema.safeParse(payload);
    if (!authorized(event) || !input.success) return { success: false, error: 'La selección de fuente no es válida.' };
    const current = service!;
    try { await current.activate(input.data.bindingId, input.data.preview); return authorized(event) && service === current ? { success: true } : { success: false, error: 'El estudio se cerró.' }; }
    catch { return { success: false, error: 'La fuente vinculada ya no está disponible. Vuelve a vincularla.' }; }
  });
  ipcMain.handle('studio-capture:release', (event, payload: unknown) => {
    const input = studioCaptureReleaseSchema.safeParse(payload);
    if (!authorized(event) || !input.success) return { success: false, error: 'El vínculo no es válido.' };
    service!.release(input.data.bindingId); return { success: true };
  });
  ipcMain.handle('studio-capture:clear', (event, ...args) => {
    if (!authorized(event) || args.length) return { success: false, error: 'No tienes acceso al estudio.' };
    service!.clear(); return { success: true };
  });
}
export async function resolveStudioCapture(window: BrowserWindow, preview: boolean) {
  return owner === window && getAuthState().authenticated && service ? service.forRequest(preview) : { bound: false as const };
}
