/**
 * AutoDevHandlers — IPC handlers for the AutoDev autonomous programming system.
 */
import { ipcMain, type BrowserWindow } from 'electron';
import type { AutoDevService } from './autodev-service';

export function registerAutoDevHandlers(
  autoDevService: AutoDevService,
  getMainWindow: () => BrowserWindow | null,
): void {
  ipcMain.handle('autodev:get-config', async () => {
    try {
      return { success: true, config: autoDevService.getConfig() };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('autodev:update-config', async (_event, updates: any) => {
    try {
      const config = autoDevService.updateConfig(updates);
      return { success: true, config };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('autodev:run-now', async () => {
    try {
      // Don't await — run in background and return immediately
      autoDevService.runNow().catch(err => {
        console.error('[AutoDevHandlers] Run error:', err.message);
      });
      return { success: true, message: 'Run started' };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('autodev:abort', async () => {
    try {
      autoDevService.abort();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('autodev:get-status', async () => {
    try {
      return { success: true, ...autoDevService.getStatus() };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('autodev:get-history', async () => {
    try {
      return { success: true, history: autoDevService.getHistory() };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // Forward events to renderer
  autoDevService.on('run-started', (run) => {
    getMainWindow()?.webContents.send('autodev:run-started', run);
  });

  autoDevService.on('run-completed', (run) => {
    getMainWindow()?.webContents.send('autodev:run-completed', run);
  });

  autoDevService.on('status-changed', (data) => {
    getMainWindow()?.webContents.send('autodev:status-changed', data);
  });

  console.log('[AutoDevHandlers] Registered successfully');
}
