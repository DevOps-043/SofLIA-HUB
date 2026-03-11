/**
 * GmailHandlers — IPC handlers for Gmail integration.
 */
import { ipcMain, type BrowserWindow } from 'electron';
import type { GmailService } from './gmail-service';

export function registerGmailHandlers(
  gmailService: GmailService,
  _getMainWindow: () => BrowserWindow | null,
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

  // ─── Empty and delete ALL user labels ───────────────────────────
  ipcMain.handle('gmail:empty-and-delete-all-labels', async () => {
    try {
      return await gmailService.emptyAndDeleteAllLabels();
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ─── Batch modify by label ──────────────────────────────────────
  ipcMain.handle('gmail:batch-modify-by-label', async (_event, labelId: string, options?: { addLabels?: string[]; removeLabels?: string[]; deleteLabel?: boolean }) => {
    try {
      return await gmailService.batchModifyByLabel(labelId, options);
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ─── Delete label ─────────────────────────────────────────────
  ipcMain.handle('gmail:delete-label', async (_event, labelId: string) => {
    try {
      return await gmailService.deleteLabel(labelId);
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  console.log('[GmailHandlers] Registered successfully');
}
