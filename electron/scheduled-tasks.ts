import cron from 'node-cron';
import { EventEmitter } from 'node:events';
import crypto from 'node:crypto';
import path from 'node:path';
import { app } from 'electron';

import { createScheduledCronTask } from './scheduled-tasks/cron-task';
import { loadScheduledTaskMap, saveScheduledTaskMap } from './scheduled-tasks/store';
import type { ScheduledTask, ScheduledTaskMeta, ScheduledTasksConfig, ScheduledTasksStatus } from './scheduled-tasks/types';

export type { ScheduledTask, ScheduledTaskMeta, ScheduledTasksConfig, ScheduledTasksStatus } from './scheduled-tasks/types';
export { SCHEDULE_TOOLS_DECLARATIONS, handleScheduleTool } from './scheduled-tasks/tools';

export class ScheduledTasksService extends EventEmitter {
  private tasks: Map<string, ScheduledTask> = new Map();
  private config: ScheduledTasksConfig;
  private running = false;

  constructor(config?: Partial<ScheduledTasksConfig>) {
    super();
    this.config = { storagePath: config?.storagePath || path.join(app.getPath('userData'), 'scheduled_tasks.json') };
  }

  getConfig(): ScheduledTasksConfig {
    return this.config;
  }

  getStatus(): ScheduledTasksStatus {
    return { activeTasksCount: this.tasks.size, isRunning: this.running };
  }

  async init(): Promise<void> {
    this.tasks = await loadScheduledTaskMap(this.config.storagePath);
  }

  async start(): Promise<void> {
    if (this.running) return;
    for (const taskData of this.tasks.values()) {
      if (!taskData.task) taskData.task = this.createCronTask(taskData);
    }
    this.running = true;
    console.log(`[ScheduledTasksService] Servicio iniciado con ${this.tasks.size} tareas activas.`);
  }

  async stop(): Promise<void> {
    for (const task of this.tasks.values()) {
      task.task?.stop();
      task.task = null as any;
    }
    this.running = false;
    console.log('[ScheduledTasksService] Servicio detenido.');
  }

  async scheduleTask(cronTime: string, actionText: string, whatsappChatId: string, runOnce = true): Promise<string> {
    if (!cron.validate(cronTime)) {
      throw new Error(`Expresion cron invalida: ${cronTime}. Usa un formato valido de 5 o 6 campos.`);
    }

    const taskId = crypto.randomUUID();
    const meta: ScheduledTaskMeta = { id: taskId, cronTime, actionText, whatsappChatId, runOnce, createdAt: Date.now() };
    this.tasks.set(taskId, { ...meta, task: this.running ? this.createCronTask(meta) : null as any });
    await this.saveTasks();
    console.log(`[ScheduledTasksService] Tarea ${taskId} programada: ${cronTime} -> ${actionText} (Una vez: ${runOnce})`);
    return taskId;
  }

  listTasks(): ScheduledTaskMeta[] {
    return Array.from(this.tasks.values()).map(({ task: _task, ...meta }) => meta);
  }

  async cancelTask(taskId: string): Promise<boolean> {
    const task = this.tasks.get(taskId);
    if (!task) return false;
    task.task?.stop();
    this.tasks.delete(taskId);
    await this.saveTasks();
    console.log(`[ScheduledTasksService] Tarea ${taskId} cancelada.`);
    return true;
  }

  private createCronTask(meta: ScheduledTaskMeta) {
    return createScheduledCronTask(meta, (taskId) => this.cancelTask(taskId).catch(console.error), (payload) => this.emit('task_triggered', payload));
  }

  private saveTasks(): Promise<void> {
    return saveScheduledTaskMap(this.config.storagePath, this.tasks.values());
  }
}

export const scheduledTasksService = new ScheduledTasksService();
