import cron from 'node-cron';
import { EventEmitter } from 'node:events';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { app } from 'electron';

export interface ScheduledTaskMeta {
  id: string;
  cronTime: string;
  actionText: string;
  whatsappChatId: string;
  runOnce: boolean;
  createdAt: number;
}

export interface ScheduledTask extends ScheduledTaskMeta {
  task: cron.ScheduledTask;
}

export interface ScheduledTasksConfig {
  storagePath: string;
}

export interface ScheduledTasksStatus {
  activeTasksCount: number;
  isRunning: boolean;
}

export class ScheduledTasksService extends EventEmitter {
  private tasks: Map<string, ScheduledTask> = new Map();
  private config: ScheduledTasksConfig;
  private running: boolean = false;

  constructor(config?: Partial<ScheduledTasksConfig>) {
    super();
    this.config = {
      storagePath: config?.storagePath || path.join(app.getPath('userData'), 'scheduled_tasks.json'),
    };
  }

  getConfig(): ScheduledTasksConfig {
    return this.config;
  }

  getStatus(): ScheduledTasksStatus {
    return {
      activeTasksCount: this.tasks.size,
      isRunning: this.running,
    };
  }

  /**
   * Inicializa el motor de tareas cargando desde almacenamiento persistente.
   */
  async init(): Promise<void> {
    try {
      const data = await fs.readFile(this.config.storagePath, 'utf-8');
      const savedTasks: ScheduledTaskMeta[] = JSON.parse(data);

      for (const meta of savedTasks) {
        if (cron.validate(meta.cronTime)) {
          // Solo las almacenamos en memoria. start() las pondrá en marcha.
          this.tasks.set(meta.id, { ...meta, task: null as any });
        } else {
          console.warn(`[ScheduledTasksService] Expresión cron inválida saltada: ${meta.cronTime}`);
        }
      }
      console.log(`[ScheduledTasksService] Se cargaron ${this.tasks.size} tareas programadas de disco.`);
    } catch (err: any) {
      if (err.code !== 'ENOENT') {
        console.error(`[ScheduledTasksService] Error cargando tareas programadas:`, err);
      } else {
        console.log(`[ScheduledTasksService] Archivo de tareas no encontrado (nuevo inicio).`);
      }
    }
  }

  /**
   * Inicia los cron jobs de las tareas activas.
   */
  async start(): Promise<void> {
    if (this.running) return;

    for (const taskData of this.tasks.values()) {
      if (!taskData.task) {
        const task = cron.schedule(
          taskData.cronTime,
          () => {
            this.emit('task_triggered', {
              taskId: taskData.id,
              actionText: taskData.actionText,
              whatsappChatId: taskData.whatsappChatId,
            });
            if (taskData.runOnce) {
              this.cancelTask(taskData.id).catch(console.error);
            }
          },
          { scheduled: true }
        );
        taskData.task = task;
      }
    }
    this.running = true;
    console.log(`[ScheduledTasksService] Servicio iniciado con ${this.tasks.size} tareas activas.`);
  }

  /**
   * Detiene el servicio y todas las tareas programadas.
   */
  async stop(): Promise<void> {
    for (const task of this.tasks.values()) {
      if (task.task) {
        task.task.stop();
        task.task = null as any;
      }
    }
    this.running = false;
    console.log(`[ScheduledTasksService] Servicio detenido.`);
  }

  private async saveTasks(): Promise<void> {
    try {
      const metadataList = Array.from(this.tasks.values()).map(t => ({
        id: t.id,
        cronTime: t.cronTime,
        actionText: t.actionText,
        whatsappChatId: t.whatsappChatId,
        runOnce: t.runOnce,
        createdAt: t.createdAt,
      }));
      await fs.writeFile(this.config.storagePath, JSON.stringify(metadataList, null, 2), 'utf-8');
    } catch (err) {
      console.error(`[ScheduledTasksService] Error guardando tareas:`, err);
    }
  }

  /**
   * Programa una nueva tarea o recordatorio.
   */
  async scheduleTask(cronTime: string, actionText: string, whatsappChatId: string, runOnce: boolean = true): Promise<string> {
    if (!cron.validate(cronTime)) {
      throw new Error(`Expresión cron inválida: ${cronTime}. Usa un formato válido de 5 o 6 campos.`);
    }

    const taskId = crypto.randomUUID();

    let cronTask: any = null;
    if (this.running) {
      cronTask = cron.schedule(
        cronTime,
        () => {
          this.emit('task_triggered', { taskId, actionText, whatsappChatId });
          if (runOnce) {
            this.cancelTask(taskId).catch(console.error);
          }
        },
        { scheduled: true }
      );
    }

    this.tasks.set(taskId, {
      id: taskId,
      cronTime,
      actionText,
      whatsappChatId,
      runOnce,
      task: cronTask,
      createdAt: Date.now(),
    });

    await this.saveTasks();
    console.log(`[ScheduledTasksService] Tarea ${taskId} programada: ${cronTime} -> ${actionText} (Una vez: ${runOnce})`);

    return taskId;
  }

  /**
   * Obtiene la lista de tareas programadas.
   */
  listTasks() {
    return Array.from(this.tasks.values()).map(t => ({
      id: t.id,
      cronTime: t.cronTime,
      actionText: t.actionText,
      whatsappChatId: t.whatsappChatId,
      runOnce: t.runOnce,
      createdAt: t.createdAt,
    }));
  }

  /**
   * Cancela una tarea específica.
   */
  async cancelTask(taskId: string): Promise<boolean> {
    const task = this.tasks.get(taskId);
    if (task) {
      if (task.task) task.task.stop();
      this.tasks.delete(taskId);
      await this.saveTasks();
      console.log(`[ScheduledTasksService] Tarea ${taskId} cancelada.`);
      return true;
    }
    return false;
  }
}

export const scheduledTasksService = new ScheduledTasksService();

// ─── Declaraciones de Herramientas (Tools) para el LLM ──────────────

export const SCHEDULE_TOOLS_DECLARATIONS = [
  {
    name: 'schedule_reminder_tool',
    description: 'Programa un recordatorio o tarea diferida para el usuario en una fecha y hora específica utilizando una expresión cron. Debes traducir la petición natural del usuario (ej: "recuérdame mañana a las 9am...", "avísame cada lunes...") a una expresión cron válida y establecer el texto del recordatorio.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        cronTime: { type: 'STRING' as const, description: 'Expresión cron válida de 5 campos (minuto hora día_del_mes mes día_de_la_semana). Ej: "0 9 * * *" para todos los días a las 9am.' },
        actionText: { type: 'STRING' as const, description: 'Mensaje de recordatorio exacto que quieres que se envíe al usuario cuando se dispare la tarea. Ej: "Recordatorio: llamar al cliente."' },
        runOnce: { type: 'BOOLEAN' as const, description: 'Si es true, la tarea se elimina automáticamente después de ejecutarse una vez (ideal para recordatorios puntuales). Si es false, se repetirá continuamente según la expresión cron. Valor por defecto: true.' },
      },
      required: ['cronTime', 'actionText'],
    },
  },
  {
    name: 'list_scheduled_tasks',
    description: 'Lista todas las tareas y recordatorios programados actualmente para el usuario de WhatsApp.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {},
    },
  },
  {
    name: 'cancel_scheduled_task',
    description: 'Cancela un recordatorio o tarea programada. Debes usar list_scheduled_tasks primero para obtener el taskId.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        taskId: { type: 'STRING' as const, description: 'El ID único de la tarea a cancelar.' },
      },
      required: ['taskId'],
    },
  }
];

// ─── Handler de ejecución para WhatsAppAgent o el motor central ────

export const handleScheduleTool = async (toolName: string, args: Record<string, any>, whatsappChatId: string) => {
  switch (toolName) {
    case 'schedule_reminder_tool': {
      try {
        const runOnce = args.runOnce !== undefined ? args.runOnce : true;
        const taskId = await scheduledTasksService.scheduleTask(args.cronTime, args.actionText, whatsappChatId, runOnce);
        return { 
          success: true, 
          taskId, 
          message: `Recordatorio programado con éxito para la expresión cron '${args.cronTime}'. ID de la tarea: ${taskId}` 
        };
      } catch (err: any) {
        return { success: false, error: `Fallo al programar: ${err.message}` };
      }
    }
    case 'list_scheduled_tasks': {
      const tasks = scheduledTasksService.listTasks().filter(t => t.whatsappChatId === whatsappChatId);
      return { 
        success: true, 
        count: tasks.length,
        tasks: tasks.map(t => ({
          taskId: t.id,
          cronTime: t.cronTime,
          actionText: t.actionText,
          runOnce: t.runOnce,
          createdAt: new Date(t.createdAt).toLocaleString('es-MX')
        }))
      };
    }
    case 'cancel_scheduled_task': {
      const success = await scheduledTasksService.cancelTask(args.taskId);
      if (success) {
        return { success: true, message: `Tarea con ID ${args.taskId} cancelada exitosamente.` };
      } else {
        return { success: false, error: `Tarea no encontrada o no pertenece a esta sesión.` };
      }
    }
    default:
      return { success: false, error: `Herramienta desconocida en ScheduledTasks: ${toolName}` };
  }
};
