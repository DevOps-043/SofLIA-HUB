import { ipcMain } from 'electron';
import type { DesktopAgentService } from '../desktop-agent-service';
import { getErrorMessage } from './errors';

export function registerDesktopAgentStatusHandlers(agentService: DesktopAgentService) {
  ipcMain.handle('desktop-agent:get-status', async () => {
    return agentService.getStatus();
  });

  ipcMain.handle('desktop-agent:get-config', async () => {
    return agentService.getConfig();
  });

  ipcMain.handle('desktop-agent:list-browser-profiles', async () => {
    try {
      return { success: true, profiles: agentService.listBrowserProfiles() };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  });

  ipcMain.handle('desktop-agent:reset-browser-profile', async (_, profileId: string) => {
    try {
      return await agentService.resetBrowserProfile(profileId);
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  });

  ipcMain.handle('desktop-agent:set-config', async (_, updates: any) => {
    try {
      agentService.setConfig(updates);
      return { success: true, config: agentService.getConfig() };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  });
}
