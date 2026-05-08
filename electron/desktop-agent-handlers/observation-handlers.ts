import { ipcMain } from 'electron';
import type { DesktopAgentService } from '../desktop-agent-service';
import { getErrorMessage } from './errors';

export function registerDesktopAgentObservationHandlers(agentService: DesktopAgentService) {
  ipcMain.handle('desktop-agent:start-observation', async (_, objective: string, rules?: string) => {
    try {
      await agentService.startObservation(objective, rules);
      return { success: true };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  });

  ipcMain.handle('desktop-agent:stop-observation', async () => {
    agentService.stopObservation();
    return { success: true };
  });
}
