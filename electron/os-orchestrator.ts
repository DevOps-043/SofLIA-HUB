import { EventEmitter } from 'events';
import { exec } from 'child_process';
import * as os from 'os';

export interface TaskPayload {
  command?: string;
  action?: () => Promise<any>;
  notifyPhone?: string;
  [key: string]: any;
}

export interface QueuedTask {
  id: string;
  schema: any;
  payload: TaskPayload;
  isUser: boolean;
  timestamp: number;
}

export class OSOrchestrator extends EventEmitter {
  private userQueue: QueuedTask[] = [];
  private backgroundQueue: QueuedTask[] = [];
  private isProcessing: boolean = false;
  private currentBgTask: QueuedTask | null = null;
  private isBgTaskPaused: boolean = false;
  private whatsappDispatcher: any = null;

  constructor() {
    super();
  }

  public setWhatsAppDispatcher(dispatcher: any) {
    this.whatsappDispatcher = dispatcher;
  }

  // 4. Método submitTask con tipado 'any' en schema para evitar TS2345/TS2558
  public submitTask = (schema: any, payload: any, isUser: boolean): string | { status: string } => {
    // 7. Kill Switch: Si el comando del usuario es '/panic'
    if (isUser && payload && payload.command === '/panic') {
      this.executePanic();
      return { status: 'panic-triggered' };
    }

    const task: QueuedTask = {
      id: Math.random().toString(36).substring(2, 15),
      schema,
      payload,
      isUser,
      timestamp: Date.now()
    };

    if (isUser) {
      this.userQueue.push(task);
      this.emit('task-queued', { queue: 'user', taskId: task.id });
    } else {
      this.backgroundQueue.push(task);
      this.emit('task-queued', { queue: 'background', taskId: task.id });
    }

    if (!this.isProcessing) {
      this.monitorQueues();
    }

    return task.id;
  };

  // 5. Implementación del Event Loop
  public monitorQueues = async (): Promise<void> => {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      while (this.userQueue.length > 0 || this.backgroundQueue.length > 0) {
        
        // Prioridad 1: Tareas de usuario
        if (this.userQueue.length > 0) {
          // Si hay una tarea de fondo corriendo, pausarla
          if (this.currentBgTask && !this.isBgTaskPaused) {
            this.emit('pause-bg-task', { taskId: this.currentBgTask.id });
            this.isBgTaskPaused = true;
          }

          const userTask = this.userQueue.shift();
          if (userTask) {
            this.emit('task-start', { taskId: userTask.id, isUser: true });
            
            try {
              // 6. Ejecutar la tarea del usuario
              let result = null;
              if (typeof userTask.payload?.action === 'function') {
                result = await userTask.payload.action();
              } else {
                result = { status: 'success', executed: true, data: userTask.payload };
              }
              
              this.emit('task-completed', { taskId: userTask.id, result, isUser: true });
              this.notifyWhatsApp(userTask, `✅ Tarea de usuario completada exitosamente. ID: ${userTask.id}`);
            } catch (error: any) {
              this.emit('task-failed', { taskId: userTask.id, error: error.message, isUser: true });
              this.notifyWhatsApp(userTask, `❌ Error en tarea de usuario ${userTask.id}: ${error.message}`);
            }
          }
        } 
        // Prioridad 2: Tareas de fondo (solo si la cola de usuario está vacía)
        else if (this.backgroundQueue.length > 0) {
          // 6. Emitir resume-bg-task si estaba pausada
          if (this.isBgTaskPaused && this.currentBgTask) {
            this.emit('resume-bg-task', { taskId: this.currentBgTask.id });
            this.isBgTaskPaused = false;
          }

          if (!this.currentBgTask) {
            this.currentBgTask = this.backgroundQueue.shift() || null;
            
            if (this.currentBgTask) {
              this.emit('task-start', { taskId: this.currentBgTask.id, isUser: false });
              
              try {
                let result = null;
                if (typeof this.currentBgTask.payload?.action === 'function') {
                  result = await this.currentBgTask.payload.action();
                } else {
                  result = { status: 'success', executed: true, data: this.currentBgTask.payload };
                }
                
                this.emit('task-completed', { taskId: this.currentBgTask.id, result, isUser: false });
              } catch (error: any) {
                this.emit('task-failed', { taskId: this.currentBgTask.id, error: error.message, isUser: false });
              } finally {
                this.currentBgTask = null;
                this.isBgTaskPaused = false;
              }
            }
          }
        }

        // Retardo no bloqueante del event loop
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    } finally {
      this.isProcessing = false;
      this.emit('queues-empty');
    }
  };

  private notifyWhatsApp(task: QueuedTask, message: string) {
    const phone = task.payload?.notifyPhone;
    
    if (this.whatsappDispatcher && typeof this.whatsappDispatcher.sendText === 'function' && phone) {
      const jid = `${phone.replace(/\D/g, '')}@s.whatsapp.net`;
      this.whatsappDispatcher.sendText(jid, message).catch((err: any) => {
        console.error('[OSOrchestrator] Error en WhatsAppDispatcher:', err.message);
      });
    } else {
      // Alternativa: Emitir el evento para que main.ts u otro servicio lo despache
      this.emit('notify-whatsapp', {
        phone: phone || 'default',
        message
      });
    }
  }

  // 7. Kill Switch para bloquear el sistema y purgar tareas
  private executePanic = (): void => {
    this.userQueue = [];
    this.backgroundQueue = [];
    this.currentBgTask = null;
    this.isBgTaskPaused = false;
    this.isProcessing = false;
    
    this.emit('panic-mode-activated');
    this.emit('queues-purged');

    const platform = os.platform();
    try {
      if (platform === 'win32') {
        exec('rundll32.exe user32.dll,LockWorkStation');
      } else if (platform === 'darwin') {
        exec('pmset displaysleepnow');
      } else {
        exec('xdg-screensaver lock || gnome-screensaver-command -l');
      }
      this.emit('system-locked', { success: true, platform });
    } catch (error: any) {
      this.emit('system-locked', { success: false, error: error.message });
    }
  };
  
  public getStatus = () => {
    return {
      userQueueLength: this.userQueue.length,
      backgroundQueueLength: this.backgroundQueue.length,
      isProcessing: this.isProcessing,
      hasCurrentBgTask: !!this.currentBgTask,
      isBgTaskPaused: this.isBgTaskPaused
    };
  };
  
  public clearQueues = () => {
    this.userQueue = [];
    this.backgroundQueue = [];
    this.currentBgTask = null;
    this.isBgTaskPaused = false;
    this.emit('queues-purged');
  };
}

// Singleton predeterminado para el sistema
export const osOrchestrator = new OSOrchestrator();