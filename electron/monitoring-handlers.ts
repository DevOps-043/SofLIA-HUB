/**
 * MonitoringHandlers — IPC handlers for the monitoring service.
 * Follows the same pattern as computer-use-handlers.ts
 */
import { ipcMain, type BrowserWindow } from 'electron';
import type { MonitoringService, MonitoringConfig } from './monitoring-service';

export function registerMonitoringHandlers(
  monitoringService: MonitoringService,
  getMainWindow: () => BrowserWindow | null
): void {
  // ─── Start monitoring session ─────────────────────────────────────
  ipcMain.handle('monitoring:start', async (_event, userId: string, sessionId: string) => {
    try {
      await monitoringService.start(userId, sessionId);
      return { success: true, message: 'Monitoring started' };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ─── Stop monitoring session ──────────────────────────────────────
  ipcMain.handle('monitoring:stop', async () => {
    try {
      const result = await monitoringService.stop();
      return { success: true, ...result };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ─── Get current status ───────────────────────────────────────────
  ipcMain.handle('monitoring:get-status', async () => {
    return monitoringService.getStatus();
  });

  // ─── Update config ────────────────────────────────────────────────
  ipcMain.handle('monitoring:set-config', async (_event, config: Partial<MonitoringConfig>) => {
    monitoringService.setConfig(config);
    return { success: true, config: monitoringService.getStatus().config };
  });

  // ─── Cleanup old screenshots ──────────────────────────────────────
  ipcMain.handle('monitoring:cleanup-screenshots', async () => {
    const deleted = await monitoringService.cleanupScreenshots();
    return { success: true, deleted };
  });

  // ─── Forward events to renderer ───────────────────────────────────
  monitoringService.on('snapshot', (snapshot) => {
    const win = getMainWindow();
    win?.webContents.send('monitoring:snapshot', snapshot);
  });

  monitoringService.on('session-started', (data) => {
    const win = getMainWindow();
    win?.webContents.send('monitoring:session-started', data);
  });

  monitoringService.on('session-ended', (data) => {
    const win = getMainWindow();
    win?.webContents.send('monitoring:session-ended', data);
  });

  monitoringService.on('flush', (data) => {
    const win = getMainWindow();
    win?.webContents.send('monitoring:flush', data);
  });

  monitoringService.on('error', (err) => {
    const win = getMainWindow();
    win?.webContents.send('monitoring:error', { message: err.message });
  });

  console.log('[MonitoringHandlers] Registered successfully');
}
