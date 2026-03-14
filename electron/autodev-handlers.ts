/**
 * AutoDevHandlers — IPC handlers for the AutoDev autonomous programming system.
 */
import { ipcMain, type BrowserWindow } from 'electron';
import type { AutoDevService } from './autodev-service';
import type { SelfLearnService } from './autodev-selflearn';
import { handleIPC, handleIPCVoid } from './utils/ipc-helpers';

export function registerAutoDevHandlers(
  autoDevService: AutoDevService,
  selfLearnService: SelfLearnService,
  getMainWindow: () => BrowserWindow | null,
): void {
  ipcMain.handle('autodev:log-feedback', (_event, message: string) =>
    handleIPCVoid(() => { selfLearnService.analyzeUserMessage(message, 'chat'); return Promise.resolve(); }));

  ipcMain.handle('autodev:get-config', () =>
    handleIPC(async () => ({ config: autoDevService.getConfig() })));

  ipcMain.handle('autodev:update-config', (_event, updates: any) =>
    handleIPC(async () => ({ config: autoDevService.updateConfig(updates) })));

  ipcMain.handle('autodev:run-now', () =>
    handleIPC(async () => {
      autoDevService.runNow().catch(err => {
        console.error('[AutoDevHandlers] Run error:', err.message);
      });
      return { message: 'Run started' };
    }));

  ipcMain.handle('autodev:abort', () =>
    handleIPCVoid(async () => { autoDevService.abort(); }));

  ipcMain.handle('autodev:get-status', () =>
    handleIPC(async () => autoDevService.getStatus()));

  ipcMain.handle('autodev:get-history', () =>
    handleIPC(async () => ({ history: autoDevService.getHistory() })));

  ipcMain.handle('autodev:micro-fix-status', () =>
    handleIPC(async () => autoDevService.getMicroFixStatus()));

  ipcMain.handle('autodev:trigger-micro-fix', (_event, trigger: any) =>
    handleIPC(async () => { autoDevService.queueMicroFix(trigger); return { message: 'Micro-fix queued' }; }));

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
