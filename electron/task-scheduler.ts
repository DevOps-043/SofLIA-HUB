import cron from 'node-cron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { app } from 'electron';
import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';

export type ScheduledTaskKind =
  | 'legacy_prompt'
  | 'passive_prompt'
  | 'passive_workflow';

export type ScheduledTaskExecutionMode =
  | 'agent_prompt'
  | 'workflow';

export interface ScheduledTaskInfo {
  id: string;
  cronExpression: string;
  prompt: string;
  phoneNumber: string;
  createdAt: string;
  updatedAt?: string;
  lastRun?: string;
  name?: string;
  description?: string;
  scheduleLabel?: string;
  source?: 'legacy' | 'chat' | 'app';
  kind?: ScheduledTaskKind;
  executionMode?: ScheduledTaskExecutionMode;
  workflowId?: string | null;
  workflowInput?: Record<string, unknown>;
  requestedBy?: string | null;
  passiveRuleId?: string | null;
}

export interface ScheduledTaskCreateInput {
  id?: string;
  cronExpression: string;
  prompt: string;
  phoneNumber?: string;
  name?: string;
  description?: string;
  scheduleLabel?: string;
  source?: 'legacy' | 'chat' | 'app';
  kind?: ScheduledTaskKind;
  executionMode?: ScheduledTaskExecutionMode;
  workflowId?: string | null;
  workflowInput?: Record<string, unknown>;
  requestedBy?: string | null;
  passiveRuleId?: string | null;
  createdAt?: string;
  lastRun?: string;
}

export class TaskScheduler extends EventEmitter {
  private statePath: string;
  private tasks: Map<string, ScheduledTaskInfo> = new Map();
  private activeJobs: Map<string, cron.ScheduledTask> = new Map();

  constructor() {
    super();
    this.statePath = path.join(app.getPath('userData'), 'scheduler-state.json');
  }

  async init(): Promise<void> {
    await this.loadState();

    for (const task of this.tasks.values()) {
      this.startCronJob(task);
    }
    console.log(`[TaskScheduler] Inicializado. ${this.tasks.size} tareas programadas cargadas.`);
  }

  private async loadState(): Promise<void> {
    try {
      const data = await fs.readFile(this.statePath, 'utf-8');
      const loadedTasks = JSON.parse(data) as Array<Partial<ScheduledTaskInfo>>;
      this.tasks.clear();
      for (const task of loadedTasks) {
        const normalized = this.normalizeTask(task);
        this.tasks.set(normalized.id, normalized);
      }
    } catch (err: any) {
      if (err.code !== 'ENOENT') {
        console.error('[TaskScheduler] Error cargando estado:', err.message);
      }
      this.tasks.clear();
    }
  }

  private async saveState(): Promise<void> {
    try {
      const tasksArray = Array.from(this.tasks.values());
      await fs.writeFile(this.statePath, JSON.stringify(tasksArray, null, 2), 'utf-8');
    } catch (err: any) {
      console.error('[TaskScheduler] Error guardando estado:', err.message);
    }
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
    const task = this.normalizeTask({
      ...existing,
      ...input,
      id: input.id || existing?.id || randomUUID(),
      createdAt: existing?.createdAt || input.createdAt || now,
      updatedAt: now,
    });

    this.tasks.set(task.id, task);
    this.startCronJob(task);
    this.saveState().catch((error) => console.error(error));

    console.log(`[TaskScheduler] Tarea programada: ${task.id} -> "${task.prompt}" [${task.cronExpression}]`);
    return task;
  }

  getTask(taskId: string): ScheduledTaskInfo | null {
    return this.tasks.get(taskId) || null;
  }

  private normalizeTask(task: Partial<ScheduledTaskInfo>): ScheduledTaskInfo {
    const createdAt = String(task.createdAt || new Date().toISOString());
    return {
      id: String(task.id || randomUUID()),
      cronExpression: String(task.cronExpression || '').trim(),
      prompt: String(task.prompt || '').trim(),
      phoneNumber: String(task.phoneNumber || '').trim(),
      createdAt,
      updatedAt: String(task.updatedAt || createdAt),
      lastRun: task.lastRun ? String(task.lastRun) : undefined,
      name: task.name ? String(task.name).trim() : undefined,
      description: task.description ? String(task.description).trim() : undefined,
      scheduleLabel: task.scheduleLabel ? String(task.scheduleLabel).trim() : undefined,
      source: task.source === 'chat' || task.source === 'app' ? task.source : 'legacy',
      kind: task.kind || 'legacy_prompt',
      executionMode: task.executionMode || 'agent_prompt',
      workflowId: task.workflowId ? String(task.workflowId).trim() : null,
      workflowInput: task.workflowInput && typeof task.workflowInput === 'object'
        ? { ...task.workflowInput }
        : {},
      requestedBy: task.requestedBy ? String(task.requestedBy).trim() : null,
      passiveRuleId: task.passiveRuleId ? String(task.passiveRuleId).trim() : null,
    };
  }

  private startCronJob(task: ScheduledTaskInfo): void {
    if (this.activeJobs.has(task.id)) {
      this.activeJobs.get(task.id)?.stop();
    }

    const job = cron.schedule(task.cronExpression, () => {
      console.log(`[TaskScheduler] Disparando tarea diferida: ${task.id} - "${task.prompt}"`);
      task.lastRun = new Date().toISOString();
      task.updatedAt = task.lastRun;
      this.tasks.set(task.id, task);
      this.saveState().catch((error) => console.error(`[TaskScheduler] Error guardando lastRun: ${error.message}`));

      this.emit('task-triggered', {
        ...task,
        triggeredAt: task.lastRun,
      });
    });

    this.activeJobs.set(task.id, job);
  }

  getTasks(phoneNumber?: string): ScheduledTaskInfo[] {
    const allTasks = Array.from(this.tasks.values());
    if (phoneNumber) {
      return allTasks.filter((task) => task.phoneNumber === phoneNumber);
    }
    return allTasks;
  }

  deleteTask(taskId: string): boolean {
    if (!this.tasks.has(taskId)) {
      return false;
    }

    this.tasks.delete(taskId);
    this.saveState().catch((error) => console.error(error));

    const job = this.activeJobs.get(taskId);
    if (job) {
      job.stop();
      this.activeJobs.delete(taskId);
    }
    console.log(`[TaskScheduler] Tarea eliminada: ${taskId}`);
    return true;
  }

  async stop(): Promise<void> {
    for (const job of this.activeJobs.values()) {
      job.stop();
    }
    this.activeJobs.clear();
    console.log('[TaskScheduler] Todos los jobs han sido detenidos.');
  }
}

export const TASK_SCHEDULER_TOOL_DECLARATIONS = [
  {
    name: 'task_scheduler',
    description: 'Programa una tarea, recordatorio o automatizacion para que el agente la ejecute despues. Usalo cuando el usuario pida algo como "recuerdame a las 8am" o "cada lunes revisa mi email".',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        cron_expression: {
          type: 'STRING' as const,
          description: 'Expresion cron valida. Ejemplo: "0 8 * * *" para todos los dias a las 8am.',
        },
        prompt: {
          type: 'STRING' as const,
          description: 'Instruccion que se ejecutara despues. Debe quedar clara y completa.',
        },
      },
      required: ['cron_expression', 'prompt'],
    },
  },
  {
    name: 'list_scheduled_tasks',
    description: 'Lista las tareas, recordatorios y automatizaciones programadas para este usuario.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {},
    },
  },
  {
    name: 'delete_scheduled_task',
    description: 'Elimina definitivamente una tarea programada mediante su ID.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        task_id: { type: 'STRING' as const, description: 'El ID de la tarea a eliminar.' },
      },
      required: ['task_id'],
    },
  },
];

export async function handleTaskSchedulerTool(
  scheduler: TaskScheduler,
  toolName: string,
  args: Record<string, any>,
  phoneNumber: string,
): Promise<any> {
  switch (toolName) {
    case 'task_scheduler': {
      try {
        const task = scheduler.scheduleTask(args.cron_expression, args.prompt, phoneNumber);
        return {
          success: true,
          message: `Tarea programada exitosamente con ID ${task.id}. Se ejecutara con el cron: ${args.cron_expression}`,
          task,
        };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }
    case 'list_scheduled_tasks': {
      const tasks = scheduler.getTasks(phoneNumber);
      return {
        success: true,
        count: tasks.length,
        tasks: tasks.map((task) => ({
          id: task.id,
          cron_expression: task.cronExpression,
          prompt: task.prompt,
          name: task.name,
          created_at: task.createdAt,
          last_run: task.lastRun || 'Nunca',
        })),
        message: tasks.length === 0 ? 'No hay tareas programadas actualmente.' : undefined,
      };
    }
    case 'delete_scheduled_task': {
      const deleted = scheduler.deleteTask(args.task_id);
      return {
        success: deleted,
        message: deleted
          ? `Tarea ${args.task_id} eliminada y cancelada con exito.`
          : `No se encontro la tarea con ID ${args.task_id}`,
      };
    }
    default:
      return { success: false, error: 'Herramienta de scheduler desconocida' };
  }
}
