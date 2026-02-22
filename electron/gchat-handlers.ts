/**
 * GChatHandlers — IPC handlers for Google Chat integration.
 */
import { ipcMain, type BrowserWindow } from 'electron';
import type { GChatService } from './gchat-service';

export function registerGChatHandlers(
  gchatService: GChatService,
  getMainWindow: () => BrowserWindow | null,
): void {
  // ─── List spaces ──────────────────────────────────────────────────
  ipcMain.handle('gchat:list-spaces', async () => {
    try {
      return await gchatService.listSpaces();
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ─── Get messages ─────────────────────────────────────────────────
  ipcMain.handle('gchat:get-messages', async (_event, spaceName: string, maxResults?: number) => {
    try {
      return await gchatService.getMessages(spaceName, maxResults);
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ─── Send message ─────────────────────────────────────────────────
  ipcMain.handle('gchat:send-message', async (_event, spaceName: string, text: string, threadName?: string) => {
    try {
      return await gchatService.sendMessage(spaceName, text, threadName);
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ─── Add reaction ─────────────────────────────────────────────────
  ipcMain.handle('gchat:add-reaction', async (_event, messageName: string, emoji: string) => {
    try {
      return await gchatService.addReaction(messageName, emoji);
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ─── Get members ──────────────────────────────────────────────────
  ipcMain.handle('gchat:get-members', async (_event, spaceName: string) => {
    try {
      return await gchatService.getMembers(spaceName);
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  console.log('[GChatHandlers] Registered successfully');
}
