import { createDesktopAgentTask, finishDesktopAgentTask } from './task-lifecycle';
import type { DesktopTaskExecutionOptions } from './types';

export function startDesktopAgentRuntimeTask(
  service: any,
  task: string,
  options?: DesktopTaskExecutionOptions,
) {
  const taskId = service.generateTaskId();
  const maxSteps = options?.maxSteps ?? service.config.maxSteps;
  const taskAbort = new AbortController();
  // Encadenar la cancelacion del llamador (p.ej. la conversacion) a la tarea.
  if (options?.signal) {
    if (options.signal.aborted) taskAbort.abort();
    else options.signal.addEventListener('abort', () => taskAbort.abort(), { once: true });
  }
  const agentTask = createDesktopAgentTask({ taskId, task, maxSteps, abortController: taskAbort });

  service.activeTasks.set(taskId, agentTask);
  service.abortController = taskAbort;
  service.status = 'executing';
  service.currentTask = task;
  service.actionHistory = agentTask.actionHistory;
  service.currentStep = 0;
  service.currentPlan = null;
  service.recovery = agentTask.recovery;
  service.strategicPlan = null;
  service.historySummaries = [];
  service.lastZoomImage = null;
  service.currentUIElements = [];
  service.captureMode = 'grid';
  service.targetWindowLock = null;
  service.calculateScreenScale();
  service.emit('task-started', { task, maxSteps, taskId });
  console.log(`[DesktopAgent] Iniciando tarea [${taskId}]: "${task}" (max ${maxSteps} pasos)`);

  return { taskId, maxSteps, taskAbort, agentTask };
}

export function finishDesktopAgentRuntimeTask(service: any, agentTask: any, taskId: string): void {
  const legacyState = finishDesktopAgentTask({ agentTask, activeTasks: service.activeTasks, taskId });
  service.status = legacyState.status;
  service.currentTask = legacyState.currentTask;
  service.abortController = legacyState.abortController;
  service.processQueue();
}
