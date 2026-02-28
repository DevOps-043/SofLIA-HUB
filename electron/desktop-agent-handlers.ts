/**
 * Desktop Agent IPC Handlers — Main Process
 * Registra todos los handlers IPC para el servicio de control de escritorio.
 */
import { ipcMain } from 'electron';
import type { DesktopAgentService } from './desktop-agent-service';

export function registerDesktopAgentHandlers(agentService: DesktopAgentService) {
  // ─── Task execution ─────────────────────────────────────────────
  ipcMain.handle('desktop-agent:execute-task', async (_, task: string, options?: any) => {
    try {
      const result = await agentService.executeTask(task, options);
      return { success: true, message: result };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ─── Multi-Agent: Execute multiple tasks in parallel ───────────
  ipcMain.handle('desktop-agent:execute-parallel', async (_, tasks: Array<{ task: string; maxSteps?: number }>) => {
    try {
      const results = await agentService.executeParallelTasks(tasks);
      return { success: true, results };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ─── Multi-Agent: Get active tasks ─────────────────────────────
  ipcMain.handle('desktop-agent:get-active-tasks', async () => {
    try {
      const tasks = agentService.getActiveTasks().map(t => ({
        id: t.id,
        task: t.task,
        status: t.status,
        currentStep: t.currentStep,
        maxSteps: t.maxSteps,
        startedAt: t.startedAt,
        completedAt: t.completedAt,
        result: t.result,
        error: t.error,
      }));
      return { success: true, tasks, count: tasks.length };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ─── Multi-Agent: Abort specific task ──────────────────────────
  ipcMain.handle('desktop-agent:abort-task', async (_, taskId: string) => {
    try {
      agentService.abort(taskId);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('desktop-agent:abort', async () => {
    agentService.abortAll();
    return { success: true };
  });

  // ─── Status & Config ────────────────────────────────────────────
  ipcMain.handle('desktop-agent:get-status', async () => {
    return agentService.getStatus();
  });

  ipcMain.handle('desktop-agent:get-config', async () => {
    return agentService.getConfig();
  });

  ipcMain.handle('desktop-agent:set-config', async (_, updates: any) => {
    try {
      agentService.setConfig(updates);
      return { success: true, config: agentService.getConfig() };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ─── Continuous Observation ─────────────────────────────────────
  ipcMain.handle('desktop-agent:start-observation', async (_, objective: string, rules?: string) => {
    try {
      await agentService.startObservation(objective, rules);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('desktop-agent:stop-observation', async () => {
    agentService.stopObservation();
    return { success: true };
  });

  // ─── Direct primitive actions ───────────────────────────────────
  ipcMain.handle('desktop-agent:click', async (_, x: number, y: number) => {
    try { await agentService.mouseClick(x, y); return { success: true }; }
    catch (err: any) { return { success: false, error: err.message }; }
  });

  ipcMain.handle('desktop-agent:double-click', async (_, x: number, y: number) => {
    try { await agentService.mouseDoubleClick(x, y); return { success: true }; }
    catch (err: any) { return { success: false, error: err.message }; }
  });

  ipcMain.handle('desktop-agent:right-click', async (_, x: number, y: number) => {
    try { await agentService.mouseRightClick(x, y); return { success: true }; }
    catch (err: any) { return { success: false, error: err.message }; }
  });

  ipcMain.handle('desktop-agent:drag', async (_, x1: number, y1: number, x2: number, y2: number) => {
    try { await agentService.mouseDrag(x1, y1, x2, y2); return { success: true }; }
    catch (err: any) { return { success: false, error: err.message }; }
  });

  ipcMain.handle('desktop-agent:type', async (_, text: string) => {
    try { await agentService.keyboardType(text); return { success: true }; }
    catch (err: any) { return { success: false, error: err.message }; }
  });

  ipcMain.handle('desktop-agent:key', async (_, key: string) => {
    try { await agentService.keyboardKey(key); return { success: true }; }
    catch (err: any) { return { success: false, error: err.message }; }
  });

  ipcMain.handle('desktop-agent:scroll', async (_, direction: 'up' | 'down', amount?: number) => {
    try { await agentService.mouseScroll(direction, amount); return { success: true }; }
    catch (err: any) { return { success: false, error: err.message }; }
  });

  // ─── Window management ──────────────────────────────────────────
  ipcMain.handle('desktop-agent:focus-window', async (_, title: string) => {
    try {
      const found = await agentService.focusWindow(title);
      return { success: true, found };
    } catch (err: any) { return { success: false, error: err.message }; }
  });

  ipcMain.handle('desktop-agent:list-windows', async () => {
    try {
      const windows = await agentService.listWindows();
      return { success: true, windows };
    } catch (err: any) { return { success: false, error: err.message }; }
  });

  ipcMain.handle('desktop-agent:take-screenshot', async (_, fullRes?: boolean) => {
    try {
      const base64 = await agentService.takeScreenshot(fullRes);
      return { success: true, data: base64 };
    } catch (err: any) { return { success: false, error: err.message }; }
  });
}
