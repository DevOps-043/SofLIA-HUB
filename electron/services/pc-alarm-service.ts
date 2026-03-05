import { Notification } from 'electron';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { EventEmitter } from 'node:events';
import * as crypto from 'node:crypto';

const execAsync = promisify(exec);

export interface AlarmConfig {
  /**
   * Duración del sonido de la alarma en milisegundos (usado en Windows)
   */
  defaultSoundDuration: number;
}

export interface AlarmInfo {
  id: string;
  triggerTime: number; // Timestamp en ms
  message: string;
}

export interface AlarmStatus {
  activeAlarms: number;
  alarms: AlarmInfo[];
  isRunning: boolean;
}

/**
 * Servicio nativo para programar alarmas sonoras y notificaciones visuales.
 * Sigue el patrón estándar de servicios del sistema (extiende EventEmitter).
 */
export class PcAlarmService extends EventEmitter {
  private config: AlarmConfig;
  private alarms: Map<string, { info: AlarmInfo; timerId: NodeJS.Timeout }> = new Map();
  private isRunning: boolean = false;

  constructor(config: AlarmConfig = { defaultSoundDuration: 1500 }) {
    super();
    this.config = config;
  }

  /**
   * Inicializa el servicio
   */
  async init(): Promise<void> {
    console.log('[PcAlarmService] Inicializado correctamente');
  }

  /**
   * Inicia la ejecución del servicio permitiendo programar alarmas
   */
  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('[PcAlarmService] Servicio iniciado y listo para recibir alarmas');
    this.emit('started');
  }

  /**
   * Detiene el servicio y cancela todas las alarmas activas
   */
  async stop(): Promise<void> {
    this.isRunning = false;
    
    // Limpiar todos los timeouts activos
    for (const alarmData of this.alarms.values()) {
      clearTimeout(alarmData.timerId);
    }
    
    this.alarms.clear();
    console.log('[PcAlarmService] Servicio detenido. Se han cancelado todas las alarmas pendientes.');
    this.emit('stopped');
  }

  /**
   * Programa una nueva alarma en el sistema
   * @param minutes Minutos a esperar antes de disparar la alarma
   * @param message Mensaje que se mostrará en la notificación
   * @param customId Identificador opcional (si no se envía, se genera un UUID)
   * @returns El ID de la alarma creada
   */
  setAlarm(minutes: number, message: string, customId?: string): string {
    if (!this.isRunning) {
      throw new Error('El servicio de alarmas no está en ejecución. Llama a start() primero.');
    }

    if (minutes <= 0) {
      throw new Error('El tiempo de la alarma debe ser mayor a 0 minutos.');
    }

    const id = customId || crypto.randomUUID();
    const ms = minutes * 60000;
    const triggerTime = Date.now() + ms;

    const timerId = setTimeout(async () => {
      await this.triggerAlarm(id, message);
    }, ms);

    this.alarms.set(id, {
      info: { id, triggerTime, message },
      timerId
    });

    console.log(`[PcAlarmService] Alarma programada con ID [${id}] para dentro de ${minutes} minuto(s). Mensaje: "${message}"`);
    this.emit('alarm_set', this.alarms.get(id)?.info);
    
    return id;
  }

  /**
   * Cancela una alarma previamente programada
   * @param id ID de la alarma a cancelar
   * @returns true si se canceló correctamente, false si no existía
   */
  cancelAlarm(id: string): boolean {
    const alarmData = this.alarms.get(id);
    
    if (alarmData) {
      clearTimeout(alarmData.timerId);
      this.alarms.delete(id);
      console.log(`[PcAlarmService] Alarma cancelada correctamente: ${id}`);
      this.emit('alarm_cancelled', { id });
      return true;
    }
    
    console.warn(`[PcAlarmService] Intento de cancelar una alarma inexistente o ya ejecutada: ${id}`);
    return false;
  }

  /**
   * Dispara la alarma mostrando la notificación y reproduciendo el sonido
   */
  private async triggerAlarm(id: string, message: string): Promise<void> {
    console.log(`[PcAlarmService] ¡DISPARANDO ALARMA! ID: ${id}, Mensaje: "${message}"`);
    
    try {
      // 1. Mostrar notificación visual nativa del SO
      if (Notification.isSupported()) {
        const notification = new Notification({ 
          title: '⏰ SofLIA Alarma', 
          body: message, 
          urgency: 'critical',
        });
        notification.show();
      } else {
        console.warn('[PcAlarmService] Las notificaciones nativas no están soportadas en este sistema operativo');
      }

      // 2. Reproducir sonido según el Sistema Operativo subyacente
      const isWin = process.platform === 'win32';
      const isMac = process.platform === 'darwin';
      const isLinux = process.platform === 'linux';

      if (isWin) {
        // En Windows: Usar PowerShell para emitir un beep de 1000Hz
        await execAsync(`powershell -c "[console]::beep(1000, ${this.config.defaultSoundDuration})"`);
      } else if (isMac) {
        // En macOS: Usar el comando 'say' para sintetizar voz con el mensaje
        await execAsync(`say "Alarma: ${message}"`);
      } else if (isLinux) {
        // En Linux: Intentar usar spd-say para sintetizar voz
        try {
          await execAsync(`spd-say "Alarma: ${message}"`);
        } catch {
          console.log('[PcAlarmService] No se encontraron herramientas de audio por defecto (spd-say) en Linux');
        }
      }
    } catch (error) {
      console.error(`[PcAlarmService] Fallo al ejecutar los comandos de sistema para la alarma ${id}:`, error);
    } finally {
      // Remover la alarma de la lista activa ya que acaba de ejecutarse
      this.alarms.delete(id);
      this.emit('alarm_triggered', { id, message });
    }
  }

  /**
   * Obtiene el estado actual del servicio y la lista de alarmas activas
   */
  getStatus(): AlarmStatus {
    // Retornamos la info sin el timerId que no es serializable
    const alarmsList = Array.from(this.alarms.values()).map(data => data.info);

    return {
      activeAlarms: this.alarms.size,
      alarms: alarmsList,
      isRunning: this.isRunning
    };
  }

  /**
   * Obtiene la configuración activa del servicio
   */
  getConfig(): AlarmConfig {
    return this.config;
  }
}
