import { ipcMain } from 'electron';
import type { DesktopAgentService } from '../desktop-agent-service';
import { getErrorMessage } from './errors';

export function registerDesktopAgentPrimitiveHandlers(agentService: DesktopAgentService) {
  ipcMain.handle('desktop-agent:click', async (_, x: number, y: number) => {
    try { await agentService.mouseClick(x, y); return { success: true }; }
    catch (error) { return { success: false, error: getErrorMessage(error) }; }
  });

  ipcMain.handle('desktop-agent:double-click', async (_, x: number, y: number) => {
    try { await agentService.mouseDoubleClick(x, y); return { success: true }; }
    catch (error) { return { success: false, error: getErrorMessage(error) }; }
  });

  ipcMain.handle('desktop-agent:right-click', async (_, x: number, y: number) => {
    try { await agentService.mouseRightClick(x, y); return { success: true }; }
    catch (error) { return { success: false, error: getErrorMessage(error) }; }
  });

  ipcMain.handle('desktop-agent:drag', async (_, x1: number, y1: number, x2: number, y2: number) => {
    try { await agentService.mouseDrag(x1, y1, x2, y2); return { success: true }; }
    catch (error) { return { success: false, error: getErrorMessage(error) }; }
  });

  ipcMain.handle('desktop-agent:type', async (_, text: string) => {
    try { await agentService.keyboardType(text); return { success: true }; }
    catch (error) { return { success: false, error: getErrorMessage(error) }; }
  });

  ipcMain.handle('desktop-agent:key', async (_, key: string) => {
    try { await agentService.keyboardKey(key); return { success: true }; }
    catch (error) { return { success: false, error: getErrorMessage(error) }; }
  });

  ipcMain.handle('desktop-agent:scroll', async (_, direction: 'up' | 'down', amount?: number) => {
    try { await agentService.mouseScroll(direction, amount); return { success: true }; }
    catch (error) { return { success: false, error: getErrorMessage(error) }; }
  });
}
