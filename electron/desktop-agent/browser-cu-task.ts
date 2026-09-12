import { randomUUID } from 'node:crypto';
import { BrowserCuSupervisor } from './browser-cu-supervisor';

type BrowserCuTask = {
  taskId: string;
  currentTask: string;
  currentStep: number;
  maxSteps: number;
  status: 'executing';
  controller: AbortController;
  supervisor: BrowserCuSupervisor;
};
const tasks = new WeakMap<object, BrowserCuTask>();

/** Reserva antes del primer await; una cancelación no libera operaciones nativas en vuelo. */
export function beginBrowserCuTask(service: object, task: string, maxSteps: number, source?: AbortSignal) {
  if (tasks.has(service)) throw new Error('Ya hay una tarea visual de navegador terminando o en ejecución.');
  const controller = new AbortController();
  const taskId = `browser-cu-${randomUUID()}`;
  const supervisor = new BrowserCuSupervisor(taskId, maxSteps, controller);
  const entry: BrowserCuTask = { taskId, currentTask: task, currentStep: 0, maxSteps, status: 'executing', controller, supervisor };
  const abort = () => controller.abort();
  if (source?.aborted) abort();
  else source?.addEventListener('abort', abort, { once: true });
  tasks.set(service, entry);
  return {
    taskId: entry.taskId,
    signal: controller.signal,
    supervisor,
    finish() {
      supervisor.finish();
      source?.removeEventListener('abort', abort);
      if (tasks.get(service) === entry) tasks.delete(service);
    },
  };
}

export function abortBrowserCuTask(service: object, taskId?: string): boolean {
  const entry = tasks.get(service);
  if (!entry || (taskId !== undefined && taskId !== entry.taskId)) return false;
  entry.controller.abort();
  return true;
}

export function getBrowserCuTask(service: object) {
  const entry = tasks.get(service);
  if (!entry) return null;
  return { taskId: entry.taskId, currentTask: entry.currentTask, currentStep: entry.currentStep, maxSteps: entry.maxSteps, status: entry.supervisor.snapshot().status === 'paused' ? 'waiting' : entry.status };
}

export function updateBrowserCuStep(service: object, taskId: string | null, step: number): void {
  const entry = tasks.get(service);
  if (entry?.taskId === taskId) { entry.currentStep = step; entry.supervisor.step(step); }
}
