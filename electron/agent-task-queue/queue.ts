import { EventEmitter } from 'node:events';
import type { ActiveTask } from './types';

function createTaskId(taskName: string): string {
  return `${taskName}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function buildCancellationError(taskName: string, taskId: string, duringExecution: boolean): Error {
  const suffix = duringExecution ? 'durante su ejecucion' : 'por el usuario o el sistema';
  return new Error(`Tarea ${taskName} (${taskId}) fue cancelada ${suffix}.`);
}

export class AgentTaskQueue extends EventEmitter {
  private activeTasks: Map<string, ActiveTask> = new Map();

  public async executeWithRetry<T>(
    taskName: string,
    fn: (signal: AbortSignal) => Promise<T>,
    maxRetries: number = 3,
    baseDelayMs: number = 2000,
  ): Promise<T> {
    const taskId = createTaskId(taskName);
    const controller = new AbortController();
    const task: ActiveTask = {
      id: taskId,
      name: taskName,
      controller,
      status: 'pending',
      startTime: Date.now(),
      attempts: 0,
    };

    this.activeTasks.set(taskId, task);
    this.emit('task:added', task);

    let lastError: Error | unknown;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      if (controller.signal.aborted) {
        this.finishTask(taskId, task, 'cancelled');
        throw buildCancellationError(taskName, taskId, false);
      }

      task.attempts = attempt;
      task.status = 'running';
      this.emit('task:running', task);

      try {
        const result = await fn(controller.signal);
        this.finishTask(taskId, task, 'completed');
        return result;
      } catch (error: any) {
        lastError = error;
        if (controller.signal.aborted) {
          this.finishTask(taskId, task, 'cancelled');
          throw buildCancellationError(taskName, taskId, true);
        }

        console.error(`[AgentTaskQueue] Intento ${attempt}/${maxRetries} fallido para la tarea ${taskName}: ${error?.message || error}`);
        if (attempt < maxRetries) {
          task.status = 'retrying';
          this.emit('task:retrying', task);
          const delay = baseDelayMs * Math.pow(2, attempt - 1);
          console.log(`[AgentTaskQueue] Reintentando tarea ${taskName} en ${delay}ms... (Intento ${attempt + 1})`);
          await new Promise<void>((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    this.finishTask(taskId, task, 'failed');
    throw lastError;
  }

  public cancelTask(taskId: string): boolean {
    const task = this.activeTasks.get(taskId);
    if (!task) return false;

    task.controller.abort();
    this.finishTask(taskId, task, 'cancelled');
    console.log(`[AgentTaskQueue] Tarea ${task.name} (${taskId}) cancelada con exito.`);
    return true;
  }

  public listActiveTasks(): ActiveTask[] {
    return Array.from(this.activeTasks.values());
  }

  private finishTask(taskId: string, task: ActiveTask, status: ActiveTask['status']): void {
    task.status = status;
    this.emit(`task:${status}`, task);
    this.activeTasks.delete(taskId);
  }
}

export const agentTaskQueue = new AgentTaskQueue();
