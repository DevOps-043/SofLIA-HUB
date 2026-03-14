/**
 * MemoryHandlers — IPC handlers for memory management.
 * Exposes memory stats, compaction, and fact management to the renderer process.
 */
import { ipcMain } from 'electron';
import type { MemoryService } from './memory-service';
import { handleIPC } from './utils/ipc-helpers';

export function registerMemoryHandlers(memoryService: MemoryService): void {
  ipcMain.handle('memory:get-stats', async (_event, sessionKey?: string) => {
    return memoryService.getStats(sessionKey);
  });

  ipcMain.handle('memory:compact', (_event, daysToKeep?: number) =>
    handleIPC(() => memoryService.compactOldData(daysToKeep || 90)));

  ipcMain.handle('memory:get-facts', async (_event, phoneNumber: string) => {
    return memoryService.getFacts(phoneNumber);
  });

  ipcMain.handle('memory:delete-fact', async (_event, factId: number) => {
    const ok = memoryService.deleteFact(factId);
    return { success: ok };
  });

  ipcMain.handle('memory:search', (_event, sessionKey: string, phoneNumber: string, query: string) =>
    handleIPC(async () => ({ results: await memoryService.searchMemory(sessionKey, phoneNumber, query) })));

  console.log('[MemoryHandlers] Registered successfully');
}
