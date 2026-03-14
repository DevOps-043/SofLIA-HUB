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
  ipcMain.handle('gmail:modify-labels', async (_event, messageId: string, addLabels?: string[], removeLabels?: string[]) => {
    try {
      if (!addLabels?.length && !removeLabels?.length) {
        return { success: true };
      }

      // Fetch current labels to map names to IDs
      const labelsRes = await gmailService.getLabels();
      if (!labelsRes.success || !labelsRes.labels) {
        return { success: false, error: labelsRes.error || 'Failed to fetch labels for mapping' };
      }

      const existingLabels = labelsRes.labels;
      const addLabelIds: string[] = [];
      const removeLabelIds: string[] = [];

      // Helper to match label by exact ID or case-insensitive Name
      const findLabelId = (query: string) => {
        const q = query.toLowerCase();
        const found = existingLabels.find(l => l.id.toLowerCase() === q || l.name.toLowerCase() === q);
        return found?.id;
      };

      // Process addLabels: map to ID or create if missing
      if (addLabels && addLabels.length > 0) {
        for (const labelName of addLabels) {
          if (!labelName.trim()) continue;
          const existingId = findLabelId(labelName);
          if (existingId) {
            addLabelIds.push(existingId);
          } else {
            // Auto-create missing label
            const createRes = await gmailService.createLabel(labelName);
            if (createRes.success && createRes.label?.id) {
              existingLabels.push(createRes.label); // Add to cache for subsequent matches
              addLabelIds.push(createRes.label.id);
            } else {
              console.warn(`[GmailHandlers] Failed to auto-create label "${labelName}":`, createRes.error);
            }
          }
        }
      }

      // Process removeLabels: map to ID
      if (removeLabels && removeLabels.length > 0) {
        for (const labelName of removeLabels) {
          if (!labelName.trim()) continue;
          const existingId = findLabelId(labelName);
          if (existingId) {
            removeLabelIds.push(existingId);
          } else {
            console.warn(`[GmailHandlers] Label to remove not found: "${labelName}"`);
          }
        }
      }

      // Proceed with actual modification using resolved IDs
      return await gmailService.modifyLabels(messageId, addLabelIds, removeLabelIds);
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ─── Trash message ──────────────────────────────────────────────
  ipcMain.handle('gmail:trash', (_event, messageId: string) => handleIPC(() => gmailService.trashMessage(messageId)));

  // ─── Get labels ─────────────────────────────────────────────────
  ipcMain.handle('gmail:get-labels', () => handleIPC(() => gmailService.getLabels()));

  // ─── Create label ─────────────────────────────────────────────
  ipcMain.handle('gmail:create-label', (_event, name: string) => handleIPC(() => gmailService.createLabel(name)));

  // ─── Empty and delete ALL user labels ───────────────────────────
  ipcMain.handle('gmail:empty-and-delete-all-labels', () => handleIPC(() => gmailService.emptyAndDeleteAllLabels()));

  // ─── Batch modify by label ──────────────────────────────────────
  ipcMain.handle('gmail:batch-modify-by-label', (_event, labelId: string, options?: { addLabels?: string[]; removeLabels?: string[]; deleteLabel?: boolean }) =>
    handleIPC(() => gmailService.batchModifyByLabel(labelId, options)));

  // ─── Delete label ─────────────────────────────────────────────
  ipcMain.handle('gmail:delete-label', (_event, labelId: string) => handleIPC(() => gmailService.deleteLabel(labelId)));

  console.log('[GmailHandlers] Registered successfully');
}
