import { ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import { getAuthState, onAuthStateChange } from '../main/auth-state';
import { guidanceControlSchema, guidanceRequestSchema, practiceDefinitionSchema, type GuidanceResult } from '../../src/shared/orb-guidance';
import type { OrbGuidanceService } from './service';

export function registerGuidanceHandlers(options: {
  service: OrbGuidanceService;
  getWindows: () => Array<BrowserWindow | null>;
  abortComputer: () => void;
  computerRunning: () => boolean;
}): () => void {
  let epoch = 0;
  const unsubscribe = onAuthStateChange(() => { epoch++; options.service.clear(); });
  const channels = ['orb:guidance-get', 'orb:guidance-control', 'orb:practice-start', 'orb:practice-check', 'orb:guidance-show'];
  const authorize = (event: IpcMainInvokeEvent) => {
    const auth = getAuthState(), revision = epoch;
    const window = options.getWindows().find(window => window && !window.isDestroyed() && window.webContents.id === event.sender.id);
    const frame = event.senderFrame;
    if (!auth.authenticated || !auth.userId || !window || !frame || frame !== window.webContents.mainFrame) throw new Error('Acceso no autorizado.');
    return () => {
      const current = getAuthState();
      if (revision !== epoch || !current.authenticated || current.userId !== auth.userId || window.isDestroyed()
        || !options.getWindows().includes(window) || frame !== window.webContents.mainFrame) throw new Error('La sesión o la ventana cambió.');
    };
  };
  const run = async (event: IpcMainInvokeEvent, operation: (assertCurrent: () => void) => Promise<void> | void): Promise<GuidanceResult> => {
    try { const assertCurrent = authorize(event); await operation(assertCurrent); assertCurrent(); return { success: true, state: options.service.getState() }; }
    catch (error) { return { success: false, error: error instanceof Error ? error.message : 'No se pudo actualizar la asistencia.' }; }
  };
  ipcMain.handle(channels[0], (event, ...args: unknown[]) => run(event, () => { if (args.length) throw new Error('Solicitud inválida.'); }));
  ipcMain.handle(channels[1], (event, ...args: unknown[]) => run(event, () => {
    const parsed = args.length === 1 ? guidanceControlSchema.safeParse(args[0]) : null;
    if (!parsed?.success) throw new Error('El control solicitado no es válido.');
    if (parsed.data.action === 'stop') options.abortComputer();
    options.service.control(parsed.data);
  }));
  ipcMain.handle(channels[2], (event, ...args: unknown[]) => run(event, async assertCurrent => {
    const parsed = args.length === 1 ? practiceDefinitionSchema.safeParse(args[0]) : null;
    if (!parsed?.success) throw new Error('Define entre 1 y 20 pasos con objetivo, instrucción y resultado esperado.');
    if (options.computerRunning()) throw new Error('Detén Computer Use antes de comenzar la práctica.');
    assertCurrent();
    await options.service.startPractice(parsed.data);
  }));
  ipcMain.handle(channels[3], (event, ...args: unknown[]) => run(event, async () => {
    if (args.length) throw new Error('Solicitud inválida.');
    await options.service.checkPractice();
  }));
  ipcMain.handle(channels[4], (event, ...args: unknown[]) => run(event, async () => {
    const parsed = args.length === 1 ? guidanceRequestSchema.safeParse(args[0]) : null;
    if (!parsed?.success) throw new Error('Indica texto visible, instrucción y un estilo válido.');
    if (options.computerRunning()) throw new Error('Espera a que termine Computer Use antes de señalar otro objetivo.');
    await options.service.showTarget(parsed.data);
  }));
  return () => { unsubscribe(); for (const channel of channels) ipcMain.removeHandler(channel); };
}
