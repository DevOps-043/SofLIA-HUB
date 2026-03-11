import { EventEmitter } from 'node:events';

export interface ActiveTask {
  id: string;
  name: string;
  controller: AbortController;
  status: 'pending' | 'running' | 'retrying' | 'cancelled' | 'completed' | 'failed';
  startTime: number;
  attempts: number;
}

/**
 * AgentTaskQueue
 * 
 * Motor de Cola de Tareas Resiliente (Resilient Task Monitor)
 * Proporciona ejecución de tareas con Exponential Backoff y cancelación
 * mediante AbortController, previniendo fallos por rate limits de LLMs
 * o errores de red intermitentes ("fetch failed").
 */
export class AgentTaskQueue extends EventEmitter {
  private activeTasks: Map<string, ActiveTask> = new Map();

  constructor() {
    super();
  }

  /**
   * Ejecuta una tarea asíncrona con reintentos automáticos y soporte para cancelación.
   * Utiliza Exponential Backoff para evadir rate limits y errores de red temporales.
   * 
   * @param taskName Nombre descriptivo de la tarea
   * @param fn Función asíncrona a ejecutar. Recibe un AbortSignal que debe ser respetado.
   * @param maxRetries Número máximo de intentos (por defecto 3)
   * @param baseDelayMs Retraso base en milisegundos para el backoff exponencial (por defecto 2000)
   * @returns El resultado de la función `fn`
   */
  public async executeWithRetry<T>(
    taskName: string,
    fn: (signal: AbortSignal) => Promise<T>,
    maxRetries: number = 3,
    baseDelayMs: number = 2000
  ): Promise<T> {
    const taskId = `${taskName}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const controller = new AbortController();
    
    const task: ActiveTask = {
      id: taskId,
      name: taskName,
      controller,
      status: 'pending',
      startTime: Date.now(),
      attempts: 0
    };
    
    this.activeTasks.set(taskId, task);
    this.emit('task:added', task);

    let lastError: Error | unknown;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      if (controller.signal.aborted) {
        task.status = 'cancelled';
        this.emit('task:cancelled', task);
        this.activeTasks.delete(taskId);
        throw new Error(`Tarea ${taskName} (${taskId}) fue cancelada por el usuario o el sistema.`);
      }

      task.attempts = attempt;
      task.status = 'running';
      this.emit('task:running', task);

      try {
        // Ejecutamos la tarea, pasándole la señal de aborto
        const result = await fn(controller.signal);
        
        task.status = 'completed';
        this.emit('task:completed', task);
        this.activeTasks.delete(taskId);
        
        return result;
      } catch (error: any) {
        lastError = error;
        
        if (controller.signal.aborted) {
          task.status = 'cancelled';
          this.emit('task:cancelled', task);
          this.activeTasks.delete(taskId);
          throw new Error(`Tarea ${taskName} (${taskId}) fue cancelada durante su ejecución.`);
        }

        console.error(`[AgentTaskQueue] Intento ${attempt}/${maxRetries} fallido para la tarea ${taskName}: ${error?.message || error}`);
        
        if (attempt < maxRetries) {
          task.status = 'retrying';
          this.emit('task:retrying', task);
          
          // Exponential backoff: baseDelayMs * 2^(attempt - 1)
          const delay = baseDelayMs * Math.pow(2, attempt - 1);
          console.log(`[AgentTaskQueue] Reintentando tarea ${taskName} en ${delay}ms... (Intento ${attempt + 1})`);
          
          // TS1200 prevention: Keep arrow function on same line
          await new Promise<void>((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    task.status = 'failed';
    this.emit('task:failed', task);
    this.activeTasks.delete(taskId);
    throw lastError;
  }

  /**
   * Cancela una tarea activa utilizando su ID.
   * Llama a `controller.abort()` para la tarea correspondiente.
   * 
   * @param taskId ID único de la tarea
   * @returns true si la tarea fue encontrada y cancelada, false en caso contrario
   */
  public cancelTask(taskId: string): boolean {
    const task = this.activeTasks.get(taskId);
    if (task) {
      task.controller.abort();
      task.status = 'cancelled';
      this.emit('task:cancelled', task);
      this.activeTasks.delete(taskId);
      console.log(`[AgentTaskQueue] Tarea ${task.name} (${taskId}) cancelada con éxito.`);
      return true;
    }
    return false;
  }

  /**
   * Lista todas las tareas que actualmente están en la cola.
   * 
   * @returns Array de tareas activas
   */
  public listActiveTasks(): ActiveTask[] {
    return Array.from(this.activeTasks.values());
  }
}

// Singleton global para manejar las tareas en todo el sistema
export const agentTaskQueue = new AgentTaskQueue();

// Definición de las herramientas para el LLM (AI Agent)
export const TASK_QUEUE_TOOLS = [
  {
    name: 'list_active_tasks',
    description: 'Lista todas las tareas en segundo plano activas, sus IDs, nombres y estado actual.',
    parameters: {
      type: 'OBJECT',
      properties: {}
    }
  },
  {
    name: 'cancel_background_task',
    description: 'Cancela una tarea en segundo plano en ejecución usando su ID, útil si un proceso tarda demasiado o ya no es necesario.',
    parameters: {
      type: 'OBJECT',
      properties: {
        taskId: {
          type: 'STRING',
          description: 'El ID único de la tarea que se desea cancelar.'
        }
      },
      required: ['taskId']
    }
  }
];

/**
 * Handler para procesar las llamadas a herramientas desde el LLM
 */
export async function handleTaskQueueTool(name: string, args: any): Promise<any> {
  switch (name) {
    case 'list_active_tasks': {
      const tasks = agentTaskQueue.listActiveTasks();
      if (tasks.length === 0) {
        return { message: 'No hay tareas activas en ejecución en este momento.' };
      }
      
      // TS1200 prevention: Keep arrow function on same line
      const formattedTasks = tasks.map(t => ({
        id: t.id,
        name: t.name,
        status: t.status,
        attempts: t.attempts,
        uptime_seconds: Math.floor((Date.now() - t.startTime) / 1000)
      }));
      
      return {
        total_active: formattedTasks.length,
        tasks: formattedTasks
      };
    }
    
    case 'cancel_background_task': {
      if (!args || !args.taskId) {
        throw new Error('Se requiere el parámetro "taskId" para cancelar la tarea.');
      }
      
      const success = agentTaskQueue.cancelTask(args.taskId);
      if (success) {
        return { 
          success: true, 
          message: `La tarea con ID ${args.taskId} ha sido cancelada exitosamente y su proceso ha sido abortado.` 
        };
      } else {
        return { 
          success: false, 
          error: `No se encontró la tarea con ID ${args.taskId}. Es posible que ya haya finalizado o sido cancelada previamente.` 
        };
      }
    }
    
    default:
      throw new Error(`Herramienta '${name}' no es gestionada por AgentTaskQueue.`);
  }
}
