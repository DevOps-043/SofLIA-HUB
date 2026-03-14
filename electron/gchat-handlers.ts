/**
 * GChatHandlers — IPC handlers for Google Chat integration.
 */
import { ipcMain, type BrowserWindow } from 'electron';
import type { GChatService } from './gchat-service';
import { handleIPC } from './utils/ipc-helpers';

export function registerGChatHandlers(
  gchatService: GChatService,
  _getMainWindow: () => BrowserWindow | null,
): void {
  // ─── List spaces ──────────────────────────────────────────────────
  ipcMain.handle('gchat:list-spaces', () => handleIPC(() => gchatService.listSpaces()));

  // ─── Get messages ─────────────────────────────────────────────────
  ipcMain.handle('gchat:get-messages', (_event, spaceName: string, maxResults?: number) => handleIPC(() => gchatService.getMessages(spaceName, maxResults)));

  // ─── Send message ─────────────────────────────────────────────────
  ipcMain.handle('gchat:send-message', (_event, spaceName: string, text: string, threadName?: string) => handleIPC(() => gchatService.sendMessage(spaceName, text, threadName)));

  // ─── Add reaction ─────────────────────────────────────────────────
  ipcMain.handle('gchat:add-reaction', (_event, messageName: string, emoji: string) => handleIPC(() => gchatService.addReaction(messageName, emoji)));

  // ─── Get members ──────────────────────────────────────────────────
  ipcMain.handle('gchat:get-members', (_event, spaceName: string) => handleIPC(() => gchatService.getMembers(spaceName)));

  console.log('[GChatHandlers] Registered successfully');
}
