import { agentTaskQueue } from './queue';

export const TASK_QUEUE_TOOLS = [
  {
    name: 'list_active_tasks',
    description: 'Lista todas las tareas en segundo plano activas, sus IDs, nombres y estado actual.',
    parameters: {
      type: 'OBJECT',
      properties: {},
    },
  },
  {
    name: 'cancel_background_task',
    description: 'Cancela una tarea en segundo plano en ejecucion usando su ID.',
    parameters: {
      type: 'OBJECT',
      properties: {
        taskId: {
          type: 'STRING',
          description: 'El ID unico de la tarea que se desea cancelar.',
        },
      },
      required: ['taskId'],
    },
  },
];

export async function handleTaskQueueTool(name: string, args: any): Promise<any> {
  switch (name) {
    case 'list_active_tasks':
      return listActiveTasks();
    case 'cancel_background_task':
      return cancelBackgroundTask(args);
    default:
      throw new Error(`Herramienta '${name}' no es gestionada por AgentTaskQueue.`);
  }
}

function listActiveTasks(): Record<string, unknown> {
  const tasks = agentTaskQueue.listActiveTasks();
  if (tasks.length === 0) {
    return { message: 'No hay tareas activas en ejecucion en este momento.' };
  }

  const formattedTasks = tasks.map((task) => ({
    id: task.id,
    name: task.name,
    status: task.status,
    attempts: task.attempts,
    uptime_seconds: Math.floor((Date.now() - task.startTime) / 1000),
  }));

  return {
    total_active: formattedTasks.length,
    tasks: formattedTasks,
  };
}

function cancelBackgroundTask(args: any): Record<string, unknown> {
  if (!args?.taskId) {
    throw new Error('Se requiere el parámetro "taskId" para cancelar la tarea.');
  }

  const success = agentTaskQueue.cancelTask(args.taskId);
  if (success) {
    return {
      success: true,
      message: `La tarea con ID ${args.taskId} ha sido cancelada exitosamente y su proceso ha sido abortado.`,
    };
  }

  return {
    success: false,
    error: `No se encontró la tarea con ID ${args.taskId}. Es posible que ya haya finalizado o sido cancelada previamente.`,
  };
}
