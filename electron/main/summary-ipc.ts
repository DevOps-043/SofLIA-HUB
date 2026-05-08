import { ipcMain } from 'electron';
import { sendSummaryWhatsApp } from './whatsapp-summary';
import type { MainRuntimeState } from './runtime-state';

export function registerSummaryIpcHandlers(input: { modules: any; services: any; state: MainRuntimeState }): void {
  const { modules, services, state } = input;
  ipcMain.handle('monitoring:generate-summary', async (_event, activities: any[], sessionInfo: any) => {
    if (!state.currentGeminiApiKey) {
      return { success: false, error: 'API key not configured' };
    }
    try {
      const summary = await modules.generateDailySummary(state.currentGeminiApiKey, activities, sessionInfo);
      return { success: true, summary };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });
  ipcMain.handle('monitoring:send-summary-whatsapp', async (_event, phoneNumber: string, summaryText: string) =>
    sendSummaryWhatsApp(services.waService, phoneNumber, summaryText));
}
