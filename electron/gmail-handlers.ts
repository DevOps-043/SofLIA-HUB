/**
 * GmailHandlers — IPC handlers for Gmail integration.
 */
import { ipcMain, type BrowserWindow } from 'electron';
import type { GmailService } from './gmail-service';

export function registerGmailHandlers(
  gmailService: GmailService,
  getMainWindow: () => BrowserWindow | null,
): void {
  // ─── Send email ─────────────────────────────────────────────────
  ipcMain.handle('gmail:send', async (_event, params) => {
    try {
      return await gmailService.sendEmail(params);
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ─── Get messages list ──────────────────────────────────────────
  ipcMain.handle('gmail:get-messages', async (_event, options) => {
    try {
      return await gmailService.getMessages(options);
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ─── Get single message ────────────────────────────────────────
  ipcMain.handle('gmail:get-message', async (_event, messageId: string) => {
    try {
      return await gmailService.getMessage(messageId);
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ─── Modify labels ─────────────────────────────────────────────
  ipcMain.handle('gmail:modify-labels', async (_event, messageId: string, addLabels?: string[], removeLabels?: string[]) => {
    try {
      return await gmailService.modifyLabels(messageId, addLabels, removeLabels);
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ─── Trash message ──────────────────────────────────────────────
  ipcMain.handle('gmail:trash', async (_event, messageId: string) => {
    try {
      return await gmailService.trashMessage(messageId);
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ─── Get labels ─────────────────────────────────────────────────
  ipcMain.handle('gmail:get-labels', async () => {
    try {
      return await gmailService.getLabels();
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ─── Create label ─────────────────────────────────────────────
  ipcMain.handle('gmail:create-label', async (_event, name: string) => {
    try {
      return await gmailService.createLabel(name);
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  console.log('[GmailHandlers] Registered successfully');
}
