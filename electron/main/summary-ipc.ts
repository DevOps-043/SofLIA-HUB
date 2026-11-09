import { ipcMain } from 'electron';
import { sendSummaryWhatsApp } from './whatsapp-summary';
import type { MainRuntimeState } from './runtime-state';
import { trustedAppCaller } from '../ipc/caller-authorization';

export function registerSummaryIpcHandlers(input: { modules: any; services: any; state: MainRuntimeState }): void {
  const { modules, services, state } = input;
  ipcMain.handle('monitoring:generate-summary', async (event, activities: unknown, sessionInfo: unknown) => {
    const caller = trustedAppCaller(event, () => [state.win]);
    try {
      caller.assert();
      if (!Array.isArray(activities) || activities.length > 30_000 || !sessionInfo || typeof sessionInfo !== 'object') throw new Error('Solicitud no válida.');
      const summary = await modules.generateDailySummary(activities, sessionInfo);
      caller.assert();
      return { success: true, summary };
    } catch { return { success: false, error: 'No se pudo generar el resumen de actividad.' }; }
    finally { caller.dispose(); }
  });
  ipcMain.handle('monitoring:send-summary-whatsapp', async (_event, phoneNumber: string, summaryText: string) =>
    sendSummaryWhatsApp(services.waService, phoneNumber, summaryText));
}
