/**
 * GmailHandlers — IPC handlers for Gmail integration.
 */
import { ipcMain, type BrowserWindow } from 'electron';
import type { GmailService } from './gmail-service';
import { handleIPC } from './utils/ipc-helpers';

export function registerGmailHandlers(
  gmailService: GmailService,
  _getMainWindow: () => BrowserWindow | null,
): void {
  // ─── Send email ─────────────────────────────────────────────────
  ipcMain.handle('gmail:send', (_event, params) => handleIPC(() => gmailService.sendEmail(params)));

  // ─── Get messages list ──────────────────────────────────────────
  ipcMain.handle('gmail:get-messages', (_event, options) => handleIPC(() => gmailService.getMessages(options)));

  // ─── Get single message ────────────────────────────────────────
  ipcMain.handle('gmail:get-message', (_event, messageId: string) => handleIPC(() => gmailService.getMessage(messageId)));

  // ─── Modify labels ─────────────────────────────────────────────
  ipcMain.handle('gmail:modify-labels', (_event, messageId: string, addLabels?: string[], removeLabels?: string[]) =>
    handleIPC(() => gmailService.modifyLabels(messageId, addLabels, removeLabels)));

  // ─── Trash message ──────────────────────────────────────────────
  ipcMain.handle('gmail:trash', (_event, messageId: string) => handleIPC(() => gmailService.trashMessage(messageId)));

  // ─── Get labels ─────────────────────────────────────────────────
  ipcMain.handle('gmail:get-labels', () => handleIPC(() => gmailService.getLabels()));

  // ─── Create label ─────────────────────────────────────────────
  ipcMain.handle('gmail:create-label', (_event, name: string) => handleIPC(() => gmailService.createLabel(name)));

  ipcMain.handle('gmail:preview-organization', (_event, options) =>
    handleIPC(() => gmailService.previewOrganizationPlan(options)));

  ipcMain.handle('gmail:apply-organization-plan', (_event, planId: string, options?: { removeFromInbox?: boolean }) =>
    handleIPC(() => gmailService.applyOrganizationPlan(planId, options)));

  ipcMain.handle('gmail:undo-organization-plan', (_event, planId?: string) =>
    handleIPC(() => gmailService.undoOrganizationPlan(planId)));

  // ─── Empty and delete ALL user labels ───────────────────────────
  ipcMain.handle('gmail:empty-and-delete-all-labels', () => handleIPC(() => gmailService.emptyAndDeleteAllLabels()));

  // ─── Batch modify by label ──────────────────────────────────────
  ipcMain.handle('gmail:batch-modify-by-label', (_event, labelId: string, options?: { addLabels?: string[]; removeLabels?: string[]; deleteLabel?: boolean }) =>
    handleIPC(() => gmailService.batchModifyByLabel(labelId, options)));

  // ─── Delete label ─────────────────────────────────────────────
  ipcMain.handle('gmail:delete-label', (_event, labelId: string) => handleIPC(() => gmailService.deleteLabel(labelId)));

  console.log('[GmailHandlers] Registered successfully');
}
