import { ipcMain, shell, type BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import { z } from 'zod';
import type { BackgroundTeamService } from './service';
import { attachSchema, contextSchema, controlSchema, openSchema, startSchema } from './schemas';

export function registerBackgroundTeamHandlers(service: BackgroundTeamService, getWindow: () => BrowserWindow | null): () => void {
  const channels: string[] = [];
  const sender = (event: IpcMainInvokeEvent) => {
    const window = getWindow();
    if (!window || window.isDestroyed() || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) throw new Error('Superficie no autorizada.');
  };
  const register = <T>(name: string, schema: z.ZodType<T>, action: (input: T) => Promise<unknown> | unknown, context = true) => {
    channels.push(name);
    ipcMain.handle(name, async (event, payload: unknown) => {
      try {
        sender(event); const input = schema.parse(payload);
        if (context) await service.authorize();
        const token = service.contextToken();
        const data = await action(input);
        if (context) await service.authorize();
        if (context && token !== service.contextToken()) throw new Error('El contexto cambió.');
        return { success: true, data };
      } catch { return { success: false, error: 'No se pudo completar la operación del equipo. Comprueba sesión, contexto, cifrado, proveedor y presupuesto.' }; }
    });
  };
  register('background-teams:context', contextSchema, input => service.context(input.organizationId), false);
  register('background-teams:release', z.undefined(), () => { service.invalidate(); return null; }, false);
  register('background-teams:state', z.undefined(), () => service.state());
  register('background-teams:start', startSchema, input => service.start(input));
  register('background-teams:control', controlSchema, input => service.control(input.jobId, input.action));
  register('background-teams:attach-legacy', attachSchema, async input => { await service.attachLegacy(input); return null; });
  register('background-teams:open', openSchema, async input => {
    const file = await service.artifactFile(input.jobId, input.artifactId);
    await service.authorize();
    const error = await shell.openPath(file);
    if (error) throw new Error('No se pudo abrir el archivo.');
    return null;
  });
  const changed = () => {
    const window = getWindow();
    if (window && !window.isDestroyed()) window.webContents.send('background-teams:changed');
  };
  service.on('changed', changed);
  return () => { channels.forEach(channel => ipcMain.removeHandler(channel)); service.off('changed', changed); };
}

