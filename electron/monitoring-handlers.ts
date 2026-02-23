/**
 * MonitoringHandlers — IPC handlers for the monitoring service.
 * Follows the same pattern as computer-use-handlers.ts
 */
import { ipcMain, type BrowserWindow } from 'electron';
import type { MonitoringService, MonitoringConfig } from './monitoring-service';
import type { WhatsAppService } from './whatsapp-service';
import { generateDailySummary } from './summary-generator';

export function registerMonitoringHandlers(
  monitoringService: MonitoringService,
  getMainWindow: () => BrowserWindow | null,
  waService?: WhatsAppService,
  getApiKey?: () => string | null
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

  // ─── Generate summary ─────────────────────────────────────────────
  ipcMain.handle('monitoring:generate-summary', async (_event, activities: any[], sessionInfo: any) => {
    try {
      if (!getApiKey) throw new Error('API Key provider not configured');
      const apiKey = getApiKey();
      if (!apiKey) throw new Error('Gemini API Key missing. Please set it in Settings.');

      const summary = await generateDailySummary(apiKey, activities, sessionInfo);
      return { success: true, ...summary };
    } catch (err: any) {
      console.error('[MonitoringHandlers] Summary generation failed:', err.message);
      return { success: false, error: err.message };
    }
  });

  // ─── Send summary via WhatsApp ───────────────────────────────────
  ipcMain.handle('monitoring:send-summary-whatsapp', async (_event, phoneNumber: string, summaryText: string) => {
    try {
      if (!waService) throw new Error('WhatsApp service not available');
      if (!waService.getStatus().connected) throw new Error('WhatsApp not connected');

      // Normalize number
      const cleanNumber = phoneNumber.replace(/[\s\-\+\(\)]/g, '');
      const jid = cleanNumber.includes('@') ? cleanNumber : `${cleanNumber}@s.whatsapp.net`;
      
      console.log(`[MonitoringHandlers] Sending summary to ${jid}`);
      await waService.sendText(jid, summaryText);
      return { success: true };
    } catch (err: any) {
      console.error('[MonitoringHandlers] WhatsApp send failed:', err.message);
      return { success: false, error: err.message };
    }
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

  console.log('[MonitoringHandlers] Registered successfully with WhatsApp & AI support');
}
