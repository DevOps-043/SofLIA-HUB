import { ipcMain } from 'electron';
import type { DailyDigestConfig } from './types';
import type { DailyDigestGenerator } from '../daily-digest-generator';

export function registerDailyDigestHandlers(generator: DailyDigestGenerator) {
  ipcMain.handle('daily-digest:get-config', async () => generator.getConfig());

  ipcMain.handle('daily-digest:update-config', async (_event, updates: Partial<DailyDigestConfig>) => {
    try {
      await generator.updateConfig(updates);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('daily-digest:generate-now', async (_event, phone?: string) => {
    try {
      const targetPhone = phone || generator.getConfig().phoneNumber;
      if (!targetPhone) throw new Error('No hay un numero de WhatsApp configurado para la entrega del reporte.');
      const filePath = await generator.generateAndSend(targetPhone);
      return { success: true, filePath };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });
}
