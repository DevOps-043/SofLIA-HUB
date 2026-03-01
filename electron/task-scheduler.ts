import cron from 'node-cron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { app } from 'electron';
import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';

export interface ScheduledTaskInfo {
  id: string;
  cronExpression: string;
  prompt: string;
  phoneNumber: string;
  createdAt: string;
  lastRun?: string;
}

export class TaskScheduler extends EventEmitter {
  private statePath: string;
  private tasks: Map<string, ScheduledTaskInfo> = new Map();
  private activeJobs: Map<string, cron.ScheduledTask> = new Map();

  constructor() {
    super();
    // Persist scheduled tasks in the userData directory of Electron
    this.statePath = path.join(app.getPath('userData'), 'scheduler-state.json');
  }

  /**
   * Carga el estado inicial y arranca las tareas previas desde el disco.
   */
  async init(): Promise<void> {
    await this.loadState();
    
    // Inicia todas las tareas cargadas
    for (const task of this.tasks.values()) {
      this.startCronJob(task);
    }
    console.log(`[TaskScheduler] Inicializado. ${this.tasks.size} tareas programadas cargadas.`);
  }

  /**
   * Carga el JSON de tareas desde el disco.
   */
  private async loadState(): Promise<void> {
    try {
      const data = await fs.readFile(this.statePath, 'utf-8');
      const loadedTasks: ScheduledTaskInfo[] = JSON.parse(data);
      this.tasks.clear();
      for (const t of loadedTasks) {
        this.tasks.set(t.id, t);
      }
    } catch (err: any) {
      if (err.code !== 'ENOENT') {
        console.error('[TaskScheduler] Error cargando estado:', err.message);
      }
      this.tasks.clear();
    }
  }

  /**
   * Guarda las tareas actuales en el disco.
   */
  private async saveState(): Promise<void> {
    try {
      const tasksArray = Array.from(this.tasks.values());
      await fs.writeFile(this.statePath, JSON.stringify(tasksArray, null, 2), 'utf-8');
    } catch (err: any) {
      console.error('[TaskScheduler] Error guardando estado:', err.message);
    }
  }

  /**
   * Programa una nueva tarea y la arranca.
   * @param cronExpression Expresión cron válida (ej: "0 8 * * *")
   * @param prompt Texto que se inyectará al agente IA
   * @param phoneNumber Número del usuario dueño de la tarea
   */
  scheduleTask(cronExpression: string, prompt: string, phoneNumber: string): ScheduledTaskInfo {
    if (!cron.validate(cronExpression)) {
      throw new Error(`Expresión cron inválida: "${cronExpression}"`);
    }

    const task: ScheduledTaskInfo = {
      id: randomUUID(),
      cronExpression,
      prompt,
      phoneNumber,
      createdAt: new Date().toISOString()
    };

    this.tasks.set(task.id, task);
    
    // Arrancamos el cron y guardamos en disco de forma asíncrona
    this.startCronJob(task);
    this.saveState().catch(e => console.error(e));
    
    console.log(`[TaskScheduler] Tarea programada: ${task.id} -> "${prompt}" [${cronExpression}]`);
    return task;
  }

  /**
   * Configura y arranca el job de cron en memoria.
   */
  private startCronJob(task: ScheduledTaskInfo): void {
    // Si ya existe un job corriendo con este ID, lo detenemos
    if (this.activeJobs.has(task.id)) {
      this.activeJobs.get(task.id)?.stop();
    }

    const job = cron.schedule(task.cronExpression, () => {
      console.log(`[TaskScheduler] Disparando tarea diferida: ${task.id} - "${task.prompt}"`);
      // Actualizar la fecha de última ejecución
      task.lastRun = new Date().toISOString();
      this.saveState().catch(e => console.error(`[TaskScheduler] Error guardando lastRun: ${e.message}`));
      
      // Emitir el evento para inyectar en la cola del agente (debe ser conectado en main.ts)
      this.emit('task-triggered', {
        id: task.id,
        prompt: task.prompt,
        phoneNumber: task.phoneNumber
      });
    });

    this.activeJobs.set(task.id, job);
  }

  /**
   * Obtiene todas las tareas programadas de un usuario específico.
   * Si no se especifica el número, devuelve todas.
   */
  getTasks(phoneNumber?: string): ScheduledTaskInfo[] {
    const allTasks = Array.from(this.tasks.values());
    if (phoneNumber) {
      return allTasks.filter(t => t.phoneNumber === phoneNumber);
    }
    return allTasks;
  }

  /**
   * Elimina una tarea y detiene su ejecución.
   */
  deleteTask(taskId: string): boolean {
    if (this.tasks.has(taskId)) {
      this.tasks.delete(taskId);
      this.saveState().catch(e => console.error(e));
      
      const job = this.activeJobs.get(taskId);
      if (job) {
        job.stop();
        this.activeJobs.delete(taskId);
      }
      console.log(`[TaskScheduler] Tarea eliminada: ${taskId}`);
      return true;
    }
    return false;
  }

  /**
   * Detiene todos los jobs en ejecución (útil al cerrar la aplicación).
   */
  async stop(): Promise<void> {
    for (const job of this.activeJobs.values()) {
      job.stop();
    }
    this.activeJobs.clear();
    console.log('[TaskScheduler] Todos los jobs han sido detenidos.');
  }
}

// ─── Declaraciones de Herramientas (Tools) para inyectar en WhatsApp Agent ───

export const TASK_SCHEDULER_TOOL_DECLARATIONS = [
  {
    name: 'task_scheduler',
    description: 'Programa una tarea, recordatorio o automatización para que tú (el agente) la ejecutes autónomamente en el futuro según una expresión Cron. Úsalo cuando el usuario pida "recuérdame hacer X a las 8am", "revisa el sistema cada hora", o "envíame un resumen el viernes". Cuando llegue el momento, tú mismo procesarás el prompt automáticamente.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        cron_expression: { 
          type: 'STRING' as const, 
          description: 'Expresión de tiempo en formato Cron (ej: "0 8 * * *" para todos los días a las 8am, "0 9 * * 5" para viernes a las 9am, "*/15 * * * *" para cada 15 min). INFIERE la expresión correcta analizando lo que pide el usuario.' 
        },
        prompt: { 
          type: 'STRING' as const, 
          description: 'El requerimiento exacto que tú (el agente) deberás ejecutar. Debe ser una orden clara y completa en lenguaje natural. Ej: "Escríbeme un recordatorio de la reunión de ventas", "Genera el reporte de uso de CPU y envíalo", "Revisa mi bandeja de entrada de Gmail y avísame de correos urgentes".' 
        },
      },
      required: ['cron_expression', 'prompt'],
    },
  },
  {
    name: 'list_scheduled_tasks',
    description: 'Lista todas las tareas, recordatorios y automatizaciones Cron que están actualmente programadas para ejecutarse en el futuro para este usuario.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {},
    },
  },
  {
    name: 'delete_scheduled_task',
    description: 'Elimina y cancela definitivamente una tarea programada mediante su ID (el cual puedes obtener previamente llamando a list_scheduled_tasks).',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        task_id: { type: 'STRING' as const, description: 'El ID de la tarea a eliminar.' }
      },
      required: ['task_id'],
    },
  }
];

// ─── Ejecución de las herramientas del Scheduler ──────────────────────────────
// Este handler encapsula la lógica para que pueda ser mapeada fácilmente en whatsapp-agent.ts

export async function handleTaskSchedulerTool(
  scheduler: TaskScheduler,
  toolName: string,
  args: Record<string, any>,
  phoneNumber: string
): Promise<any> {
  switch (toolName) {
    case 'task_scheduler': {
      try {
        const task = scheduler.scheduleTask(args.cron_expression, args.prompt, phoneNumber);
        return {
          success: true,
          message: `Tarea programada exitosamente con ID ${task.id}. Se ejecutará con el cron: ${args.cron_expression}`,
          task
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
        tasks: tasks.map(t => ({
          id: t.id,
          cron_expression: t.cronExpression,
          prompt: t.prompt,
          created_at: t.createdAt,
          last_run: t.lastRun || 'Nunca'
        })),
        message: tasks.length === 0 ? 'No hay tareas programadas actualmente.' : undefined
      };
    }
    case 'delete_scheduled_task': {
      const deleted = scheduler.deleteTask(args.task_id);
      return {
        success: deleted,
        message: deleted ? `Tarea ${args.task_id} eliminada y cancelada con éxito.` : `No se encontró la tarea con ID ${args.task_id}`
      };
    }
    default:
      return { success: false, error: 'Herramienta de scheduler desconocida' };
  }
}
