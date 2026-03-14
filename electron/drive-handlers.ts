/**
 * DriveHandlers — IPC handlers for Google Drive integration.
 */
import { ipcMain, type BrowserWindow } from 'electron';
import type { DriveService } from './drive-service';
import { handleIPC } from './utils/ipc-helpers';

export function registerDriveHandlers(
  driveService: DriveService,
  _getMainWindow: () => BrowserWindow | null,
): void {
  // ─── List files ─────────────────────────────────────────────────
  ipcMain.handle('drive:list-files', (_event, options) => handleIPC(() => driveService.listFiles(options)));

  // ─── Search files ───────────────────────────────────────────────
  ipcMain.handle('drive:search', (_event, query: string) => handleIPC(() => driveService.searchFiles(query)));

  // ─── Upload file ────────────────────────────────────────────────
  ipcMain.handle('drive:upload', (_event, localPath: string, options) => handleIPC(() => driveService.uploadFile(localPath, options)));

  // ─── Download file ──────────────────────────────────────────────
  ipcMain.handle('drive:download', (_event, fileId: string, destPath: string) => handleIPC(() => driveService.downloadFile(fileId, destPath)));

  // ─── Create folder ──────────────────────────────────────────────
  ipcMain.handle('drive:create-folder', (_event, name: string, parentId?: string) => handleIPC(() => driveService.createFolder(name, parentId)));

  // ─── Delete file ────────────────────────────────────────────────
  ipcMain.handle('drive:delete', (_event, fileId: string) => handleIPC(() => driveService.deleteFile(fileId)));

  // ─── Get file metadata ──────────────────────────────────────────
  ipcMain.handle('drive:get-metadata', (_event, fileId: string) => handleIPC(() => driveService.getFileMetadata(fileId)));

  console.log('[DriveHandlers] Registered successfully');
}
