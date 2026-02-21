/**
 * MemoryHandlers — IPC handlers for memory management.
 * Exposes memory stats, compaction, and fact management to the renderer process.
 */
import { ipcMain } from 'electron';
import type { MemoryService } from './memory-service';

export function registerMemoryHandlers(memoryService: MemoryService): void {
  ipcMain.handle('memory:get-stats', async (_event, sessionKey?: string) => {
    return memoryService.getStats(sessionKey);
  });

  ipcMain.handle('memory:compact', async (_event, daysToKeep?: number) => {
    try {
      const result = await memoryService.compactOldData(daysToKeep || 90);
      return { success: true, ...result };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('memory:get-facts', async (_event, phoneNumber: string) => {
    return memoryService.getFacts(phoneNumber);
  });

  ipcMain.handle('memory:delete-fact', async (_event, factId: number) => {
    const ok = memoryService.deleteFact(factId);
    return { success: ok };
  });

  ipcMain.handle('memory:search', async (_event, sessionKey: string, phoneNumber: string, query: string) => {
    try {
      const results = await memoryService.searchMemory(sessionKey, phoneNumber, query);
      return { success: true, results };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  console.log('[MemoryHandlers] Registered successfully');
}
