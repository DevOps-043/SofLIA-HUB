import { scheduledTasksService } from '../scheduled-tasks';

export const SCHEDULE_TOOLS_DECLARATIONS = [
  {
    name: 'schedule_reminder_tool',
    description: 'Programa un recordatorio o tarea diferida para el usuario en una fecha y hora especifica utilizando una expresion cron.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        cronTime: { type: 'STRING' as const, description: 'Expresion cron valida de 5 campos. Ej: "0 9 * * *".' },
        actionText: { type: 'STRING' as const, description: 'Mensaje de recordatorio exacto que se enviara al usuario.' },
        runOnce: { type: 'BOOLEAN' as const, description: 'Si es true, se elimina despues de ejecutarse una vez.' },
      },
      required: ['cronTime', 'actionText'],
    },
  },
  {
    name: 'list_scheduled_tasks',
    description: 'Lista todas las tareas y recordatorios programados actualmente para el usuario de WhatsApp.',
    parameters: { type: 'OBJECT' as const, properties: {} },
  },
  {
    name: 'cancel_scheduled_task',
    description: 'Cancela un recordatorio o tarea programada. Usa list_scheduled_tasks primero para obtener el taskId.',
    parameters: {
      type: 'OBJECT' as const,
      properties: { taskId: { type: 'STRING' as const, description: 'El ID unico de la tarea a cancelar.' } },
      required: ['taskId'],
    },
  },
];

export const handleScheduleTool = async (toolName: string, args: Record<string, any>, whatsappChatId: string) => {
  switch (toolName) {
    case 'schedule_reminder_tool':
      return scheduleReminder(args, whatsappChatId);
    case 'list_scheduled_tasks':
      return listScheduledTasks(whatsappChatId);
    case 'cancel_scheduled_task':
      return cancelScheduledTask(args.taskId);
    default:
      return { success: false, error: `Herramienta desconocida en ScheduledTasks: ${toolName}` };
  }
};

async function scheduleReminder(args: Record<string, any>, whatsappChatId: string) {
  try {
    const runOnce = args.runOnce !== undefined ? args.runOnce : true;
    const taskId = await scheduledTasksService.scheduleTask(args.cronTime, args.actionText, whatsappChatId, runOnce);
    return {
      success: true,
      taskId,
      message: `Recordatorio programado con exito para la expresion cron '${args.cronTime}'. ID de la tarea: ${taskId}`,
    };
  } catch (err: any) {
    return { success: false, error: `Fallo al programar: ${err.message}` };
  }
}

function listScheduledTasks(whatsappChatId: string) {
  const tasks = scheduledTasksService.listTasks().filter((task) => task.whatsappChatId === whatsappChatId);
  return {
    success: true,
    count: tasks.length,
    tasks: tasks.map((task) => ({
      taskId: task.id,
      cronTime: task.cronTime,
      actionText: task.actionText,
      runOnce: task.runOnce,
      createdAt: new Date(task.createdAt).toLocaleString('es-MX'),
    })),
  };
}

async function cancelScheduledTask(taskId: string) {
  const success = await scheduledTasksService.cancelTask(taskId);
  return success
    ? { success: true, message: `Tarea con ID ${taskId} cancelada exitosamente.` }
    : { success: false, error: 'Tarea no encontrada o no pertenece a esta sesion.' };
}
