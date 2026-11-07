import type { DesktopAgentService } from '../desktop-agent-service';
import { executeParallelDesktopTasks } from '../desktop-agent/parallel-task-runner';
import { buildActiveTaskViews } from './active-task-view';
import type { DesktopRegister } from './authorized-registration';
export function registerDesktopAgentTaskHandlers(service: DesktopAgentService, register: DesktopRegister, stopObservation: () => void) {
  register('execute-task', async (context, task, options) => {
    const outcome = await service.executeTaskDetailed(task, { ...options, signal: context.signal });
    context.assert(); return { success: outcome.estado === 'completada', message: outcome.mensaje, outcome, status: service.getStatus() };
  }, { effect: true });
  register('execute-parallel', async (context, tasks) => {
    const results = await executeParallelDesktopTasks(tasks.map(task => ({ ...task, signal: context.signal })), async (task, options) => {
      context.assert();
      try { return await service.executeTask(task, options); }
      catch { throw new Error('No se completó la tarea paralela de Desktop Agent.'); }
    });
    context.assert(); return { success: true, results };
  }, { effect: true });
  register('get-active-tasks', () => { const tasks = buildActiveTaskViews(service); return { success: true, tasks, count: tasks.length }; });
  register('abort-task', (_ctx, taskId) => { service.abort(taskId); return { success: true }; }, { control: true });
  register('abort', () => { stopObservation(); service.abortAll(); return { success: true }; }, { control: true });
}
