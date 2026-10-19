import { ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import { z } from 'zod';
import { getAuthState, onAuthStateChange } from '../main/auth-state';
import { outputAnswerSchema, outputOfferSchema } from '../../src/shared/studio-program';
import { StudioOutputService } from './service';

let owner: BrowserWindow | null = null;
let output: StudioOutputService | null = null;
let dispose: (() => void) | null = null;
let registered = false;
function authorized(event: IpcMainInvokeEvent) {
  return !!owner && !owner.isDestroyed() && event.sender === owner.webContents && event.senderFrame === owner.webContents.mainFrame && getAuthState().authenticated;
}
function receiver(event: IpcMainInvokeEvent) {
  return output?.window && !output.window.isDestroyed() && event.sender === output.window.webContents && event.senderFrame === output.window.webContents.mainFrame && getAuthState().authenticated ? output : null;
}
const answerSchema = z.object({ id: z.string().uuid(), answer: outputAnswerSchema }).strict();
const stateSchema = z.object({ id: z.string().uuid(), state: z.enum(['ready', 'error']) }).strict();
export function configureStudioOutput(window: BrowserWindow) {
  if (owner === window) return;
  dispose?.(); output?.close(); owner = window;
  output = new StudioOutputService(window, (state) => { if (!window.isDestroyed()) window.webContents.send('studio-output:event', { state }); });
  const close = () => output?.close();
  const navigation = (_event: unknown, _url: string, _inPlace: boolean, mainFrame: boolean) => { if (mainFrame) close(); };
  const auth = onAuthStateChange(close);
  window.on('closed', close); window.webContents.on('did-start-navigation', navigation);
  dispose = () => { auth(); window.removeListener('closed', close); window.webContents.removeListener('did-start-navigation', navigation); };
  if (registered) return; registered = true;
  ipcMain.handle('studio-output:open', async (event, payload: unknown, ...extra: unknown[]) => {
    const parsed = outputOfferSchema.safeParse(payload);
    if (!authorized(event) || !parsed.success || extra.length) return { success: false, error: 'No tienes acceso a la salida del estudio.' };
    const current = output!, actor = getAuthState().userId;
    try {
      const answer = await current.open(parsed.data);
      if (!authorized(event) || output !== current || actor !== getAuthState().userId) return { success: false, error: 'El estudio cambió durante la preparación.' };
      return { success: true, answer };
    } catch { return { success: false, error: 'No pudimos preparar la salida. Cierra la salida anterior y vuelve a intentar.' }; }
  });
  ipcMain.handle('studio-output:close', (event, ...args) => { if (!authorized(event) || args.length) return { success: false }; output!.close(); return { success: true }; });
  ipcMain.handle('studio-output:offer', (event, ...args) => { const current = receiver(event); return current && !args.length && current.offer ? { id: current.id, offer: current.offer } : null; });
  ipcMain.handle('studio-output:answer', (event, payload: unknown, ...extra: unknown[]) => {
    const current = receiver(event), parsed = answerSchema.safeParse(payload);
    return { success: !!current && !extra.length && parsed.success && current.answer(parsed.data.id, parsed.data.answer) };
  });
  ipcMain.handle('studio-output:state', (event, payload: unknown, ...extra: unknown[]) => {
    const current = receiver(event), parsed = stateSchema.safeParse(payload);
    return { success: !!current && !extra.length && parsed.success && current.state(parsed.data.id, parsed.data.state) };
  });
}
export function resolveStudioOutput(window: BrowserWindow): { prepared: boolean; frame: Electron.WebFrameMain | null } {
  if (owner !== window || !getAuthState().authenticated || !output?.window) return { prepared: false, frame: null };
  return { prepared: true, frame: output.capture() };
}
