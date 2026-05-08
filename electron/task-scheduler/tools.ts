import type { TaskScheduler } from '../task-scheduler';

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
    parameters: { type: 'OBJECT' as const, properties: {} },
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
    case 'task_scheduler':
      return createScheduledTask(scheduler, args, phoneNumber);
    case 'list_scheduled_tasks':
      return listScheduledTasks(scheduler, phoneNumber);
    case 'delete_scheduled_task':
      return deleteScheduledTask(scheduler, args.task_id);
    default:
      return { success: false, error: 'Herramienta de scheduler desconocida' };
  }
}

function createScheduledTask(scheduler: TaskScheduler, args: Record<string, any>, phoneNumber: string): any {
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

function listScheduledTasks(scheduler: TaskScheduler, phoneNumber: string): any {
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

function deleteScheduledTask(scheduler: TaskScheduler, taskId: string): any {
  const deleted = scheduler.deleteTask(taskId);
  return {
    success: deleted,
    message: deleted
      ? `Tarea ${taskId} eliminada y cancelada con exito.`
      : `No se encontro la tarea con ID ${taskId}`,
  };
}
