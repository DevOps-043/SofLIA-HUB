import type { AgentStatus, AgentTask } from '../desktop-agent-types';
import type { DesktopTaskExecutionOptions } from './types';

export type DesktopTaskQueueItem = {
  task: string;
  options?: DesktopTaskExecutionOptions;
  resolve: (value: string) => void;
  reject: (error: Error) => void;
};

type TaskEventEmitter = (eventName: string, payload?: unknown) => void;

export function abortDesktopAgentTask(input: {
  taskId?: string;
  activeTasks: Map<string, AgentTask>;
  abortController: AbortController | null;
  abortBrowserTasks: () => void;
  abortWindowsUIATasks: () => void;
  stopObservation: () => void;
  processQueue: () => void;
  emit: TaskEventEmitter;
}): void {
  if (input.taskId) {
    abortSpecificTask(input);
    return;
  }

  for (const [id, task] of input.activeTasks) {
    task.abortController.abort();
    task.status = 'idle';
    task.completedAt = Date.now();
    input.activeTasks.delete(id);
  }
  input.abortController?.abort();
  input.abortBrowserTasks();
  input.abortWindowsUIATasks();
  input.stopObservation();
  console.log('[DesktopAgent] Todas las tareas canceladas.');
}

function abortSpecificTask(input: {
  taskId?: string;
  activeTasks: Map<string, AgentTask>;
  abortBrowserTasks: () => void;
  abortWindowsUIATasks: () => void;
  processQueue: () => void;
  emit: TaskEventEmitter;
}): void {
  if (input.taskId === 'browser-web') {
    input.abortBrowserTasks();
    input.emit('task-aborted', { taskId: input.taskId });
    return;
  }
  if (input.taskId === 'windows-uia') {
    input.abortWindowsUIATasks();
    input.emit('task-aborted', { taskId: input.taskId });
    return;
  }

  const task = input.taskId ? input.activeTasks.get(input.taskId) : null;
  if (!task || !input.taskId) return;

  task.abortController.abort();
  task.status = 'idle';
  task.completedAt = Date.now();
  input.activeTasks.delete(input.taskId);
  console.log(`[DesktopAgent] Tarea ${input.taskId} cancelada.`);
  input.emit('task-aborted', { taskId: input.taskId });
  input.processQueue();
}

export function processDesktopTaskQueue(input: {
  queue: DesktopTaskQueueItem[];
  activeTasks: Map<string, AgentTask>;
  maxConcurrentAgents: number;
  executeTask: (task: string, options?: DesktopTaskExecutionOptions) => Promise<string>;
}): void {
  while (input.queue.length > 0 && input.activeTasks.size < input.maxConcurrentAgents) {
    const queued = input.queue.shift();
    if (!queued) return;
    input.executeTask(queued.task, queued.options).then(queued.resolve).catch(queued.reject);
  }
}

export function getDesktopTaskResult(
  activeTasks: Map<string, AgentTask>,
  taskId: string,
): { status: AgentStatus; result?: string; error?: string } | null {
  const task = activeTasks.get(taskId);
  return task ? { status: task.status, result: task.result, error: task.error } : null;
}
