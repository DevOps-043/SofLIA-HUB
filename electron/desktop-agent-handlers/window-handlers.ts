import { ipcMain } from 'electron';
import type { DesktopAgentService } from '../desktop-agent-service';
import { getErrorMessage } from './errors';

export function registerDesktopAgentWindowHandlers(agentService: DesktopAgentService) {
  ipcMain.handle('desktop-agent:focus-window', async (_, title: string) => {
    try {
      const found = await agentService.focusWindow(title);
      return { success: true, found };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  });

  ipcMain.handle('desktop-agent:list-windows', async () => {
    try {
      const windows = await agentService.listWindows();
      return { success: true, windows };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  });

  ipcMain.handle('desktop-agent:take-screenshot', async (_, fullRes?: boolean) => {
    try {
      const base64 = await agentService.takeScreenshot(fullRes);
      return { success: true, data: base64 };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  });
}
