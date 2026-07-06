import { ipcMain } from 'electron';
import type { DesktopAgentService } from '../desktop-agent-service';
import { buildActiveTaskViews } from './active-task-view';
import { getErrorMessage } from './errors';

type ParallelDesktopTaskRequest = {
  task: string;
  maxSteps?: number;
  backend?: 'auto' | 'browser' | 'desktop' | 'uia';
  startUrl?: string;
  browserProfile?: string;
  browserIsolated?: boolean;
  resetBrowserProfile?: boolean;
};

export function registerDesktopAgentTaskHandlers(agentService: DesktopAgentService) {
  ipcMain.handle('desktop-agent:execute-task', async (_, task: string, options?: any) => {
    try {
      const outcome = await agentService.executeTaskDetailed(task, options);
      return {
        success: outcome.estado === 'completada',
        message: outcome.mensaje,
        outcome,
        status: agentService.getStatus(),
      };
    } catch (error) {
      return { success: false, error: getErrorMessage(error), status: agentService.getStatus() };
    }
  });

  ipcMain.handle('desktop-agent:execute-parallel', async (_, tasks: ParallelDesktopTaskRequest[]) => {
    try {
      const results = await agentService.executeParallelTasks(tasks);
      return { success: true, results };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  });

  ipcMain.handle('desktop-agent:get-active-tasks', async () => {
    try {
      const tasks = buildActiveTaskViews(agentService);
      return { success: true, tasks, count: tasks.length };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  });

  ipcMain.handle('desktop-agent:abort-task', async (_, taskId: string) => {
    try {
      agentService.abort(taskId);
      return { success: true };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  });

  ipcMain.handle('desktop-agent:abort', async () => {
    agentService.abortAll();
    return { success: true };
  });
}
