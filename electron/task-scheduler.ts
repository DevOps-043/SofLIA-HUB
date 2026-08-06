import cron, { type ScheduledTask } from 'node-cron';
import path from 'node:path';
import { app } from 'electron';
import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';

import { normalizeScheduledTask } from './task-scheduler/normalizer';
import { loadScheduledTasks, saveScheduledTasks } from './task-scheduler/state-store';
import type { ScheduledTaskCreateInput, ScheduledTaskInfo } from './task-scheduler/types';

export type {
  ScheduledTaskCreateInput,
  ScheduledTaskExecutionMode,
  ScheduledTaskInfo,
  ScheduledTaskKind,
} from './task-scheduler/types';
export { TASK_SCHEDULER_TOOL_DECLARATIONS, handleTaskSchedulerTool } from './task-scheduler/tools';

export class TaskScheduler extends EventEmitter {
  private statePath: string;
  private tasks: Map<string, ScheduledTaskInfo> = new Map();
  private activeJobs: Map<string, ScheduledTask> = new Map();

  constructor() {
    super();
    this.statePath = path.join(app.getPath('userData'), 'scheduler-state.json');
  }

  async init(): Promise<void> {
    this.tasks = await loadScheduledTasks(this.statePath);
    let removedExpired = false;
    for (const task of this.tasks.values()) {
      if (isExpiredRunOnceTask(task, new Date())) {
        this.tasks.delete(task.id);
        removedExpired = true;
        continue;
      }
      this.startCronJob(task);
    }
    if (removedExpired) void this.persistState();
    console.log(`[TaskScheduler] Inicializado. ${this.tasks.size} tareas programadas cargadas.`);
  }

  scheduleTask(cronExpression: string, prompt: string, phoneNumber: string): ScheduledTaskInfo {
    return this.upsertTask({
      cronExpression,
      prompt,
      phoneNumber,
      kind: 'legacy_prompt',
      executionMode: 'agent_prompt',
      source: 'legacy',
    });
  }

  upsertTask(input: ScheduledTaskCreateInput): ScheduledTaskInfo {
    if (!cron.validate(input.cronExpression)) {
      throw new Error(`Expresion cron invalida: "${input.cronExpression}"`);
    }

    const existing = input.id ? this.tasks.get(input.id) : undefined;
    const now = new Date().toISOString();
    const task = normalizeScheduledTask({
      ...existing,
      ...input,
      id: input.id || existing?.id || randomUUID(),
      createdAt: existing?.createdAt || input.createdAt || now,
      updatedAt: now,
    });

    this.tasks.set(task.id, task);
    this.startCronJob(task);
    void this.persistState();
    console.log(`[TaskScheduler] Tarea programada: ${task.id} -> "${task.prompt}" [${task.cronExpression}]`);
    return task;
  }

  getTask(taskId: string): ScheduledTaskInfo | null {
    return this.tasks.get(taskId) || null;
  }

  getTasks(phoneNumber?: string): ScheduledTaskInfo[] {
    const allTasks = Array.from(this.tasks.values());
    return phoneNumber ? allTasks.filter((task) => task.phoneNumber === phoneNumber) : allTasks;
  }

  deleteTask(taskId: string): boolean {
    if (!this.tasks.has(taskId)) return false;
    this.tasks.delete(taskId);
    void this.persistState();

    const job = this.activeJobs.get(taskId);
    if (job) {
      job.stop();
      this.activeJobs.delete(taskId);
    }
    console.log(`[TaskScheduler] Tarea eliminada: ${taskId}`);
    return true;
  }

  async stop(): Promise<void> {
    for (const job of this.activeJobs.values()) job.stop();
    this.activeJobs.clear();
    console.log('[TaskScheduler] Todos los jobs han sido detenidos.');
  }

  private startCronJob(task: ScheduledTaskInfo): void {
    this.activeJobs.get(task.id)?.stop();
    const job = cron.schedule(task.cronExpression, () => {
      const now = new Date();
      if (task.runOnce && task.scheduledFor && !isScheduledForCurrentMinute(task.scheduledFor, now)) {
        if (isExpiredRunOnceTask(task, now)) this.deleteTask(task.id);
        return;
      }
      console.log(`[TaskScheduler] Disparando tarea diferida: ${task.id} - "${task.prompt}"`);
      task.lastRun = new Date().toISOString();
      task.updatedAt = task.lastRun;
      this.tasks.set(task.id, task);
      void this.persistState();
      this.emit('task-triggered', { ...task, triggeredAt: task.lastRun });
      if (task.runOnce) {
        this.deleteTask(task.id);
      }
    });
    this.activeJobs.set(task.id, job);
  }

  private persistState(): Promise<void> {
    return saveScheduledTasks(this.statePath, this.tasks.values());
  }
}

function isScheduledForCurrentMinute(scheduledFor: string, now: Date): boolean {
  const target = new Date(scheduledFor);
  if (Number.isNaN(target.getTime())) return true;
  return target.getFullYear() === now.getFullYear()
    && target.getMonth() === now.getMonth()
    && target.getDate() === now.getDate()
    && target.getHours() === now.getHours()
    && target.getMinutes() === now.getMinutes();
}

function isExpiredRunOnceTask(task: ScheduledTaskInfo, now: Date): boolean {
  if (!task.runOnce || !task.scheduledFor) return false;
  const target = new Date(task.scheduledFor);
  if (Number.isNaN(target.getTime())) return false;
  return target.getTime() < now.getTime() - 60_000;
}
