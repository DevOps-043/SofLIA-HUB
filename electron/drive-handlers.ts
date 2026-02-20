/**
 * DriveHandlers — IPC handlers for Google Drive integration.
 */
import { ipcMain, type BrowserWindow } from 'electron';
import type { DriveService } from './drive-service';

export function registerDriveHandlers(
  driveService: DriveService,
  getMainWindow: () => BrowserWindow | null,
): void {
  // ─── List files ─────────────────────────────────────────────────
  ipcMain.handle('drive:list-files', async (_event, options) => {
    try {
      return await driveService.listFiles(options);
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ─── Search files ───────────────────────────────────────────────
  ipcMain.handle('drive:search', async (_event, query: string) => {
    try {
      return await driveService.searchFiles(query);
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ─── Upload file ────────────────────────────────────────────────
  ipcMain.handle('drive:upload', async (_event, localPath: string, options) => {
    try {
      return await driveService.uploadFile(localPath, options);
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ─── Download file ──────────────────────────────────────────────
  ipcMain.handle('drive:download', async (_event, fileId: string, destPath: string) => {
    try {
      return await driveService.downloadFile(fileId, destPath);
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ─── Create folder ──────────────────────────────────────────────
  ipcMain.handle('drive:create-folder', async (_event, name: string, parentId?: string) => {
    try {
      return await driveService.createFolder(name, parentId);
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ─── Delete file ────────────────────────────────────────────────
  ipcMain.handle('drive:delete', async (_event, fileId: string) => {
    try {
      return await driveService.deleteFile(fileId);
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ─── Get file metadata ──────────────────────────────────────────
  ipcMain.handle('drive:get-metadata', async (_event, fileId: string) => {
    try {
      return await driveService.getFileMetadata(fileId);
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  console.log('[DriveHandlers] Registered successfully');
}
