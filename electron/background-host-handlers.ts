import { ipcMain } from 'electron';
import type { BackgroundHostService } from './background-host-service';

export function registerBackgroundHostHandlers(service: BackgroundHostService) {
  ipcMain.handle('background-host:get-status', async () => {
    try {
      return await service.getStatus();
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || String(error),
      };
    }
  });

  ipcMain.handle('background-host:update-config', async (_event, updates: { enabled?: boolean }) => {
    try {
      return await service.updateConfig(updates || {});
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || String(error),
      };
    }
  });

  ipcMain.handle('background-host:repair', async () => {
    try {
      return await service.repair();
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || String(error),
      };
    }
  });
}
