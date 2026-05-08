import { EventEmitter } from 'node:events';
import * as crypto from 'node:crypto';
import { triggerNativeAlarm } from './pc-alarm/native-trigger';
import type {
  AlarmConfig,
  AlarmEntry,
  AlarmInfo,
  AlarmStatus,
} from './pc-alarm/types';

export type {
  AlarmConfig,
  AlarmInfo,
  AlarmStatus,
} from './pc-alarm/types';

export class PcAlarmService extends EventEmitter {
  private config: AlarmConfig;
  private alarms = new Map<string, AlarmEntry>();
  private isRunning = false;

  constructor(config: AlarmConfig = { defaultSoundDuration: 1500 }) {
    super();
    this.config = config;
  }

  async init(): Promise<void> {
    console.log('[PcAlarmService] Inicializado correctamente');
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('[PcAlarmService] Servicio iniciado y listo para recibir alarmas');
    this.emit('started');
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    for (const alarmData of this.alarms.values()) clearTimeout(alarmData.timerId);
    this.alarms.clear();
    console.log('[PcAlarmService] Servicio detenido. Se han cancelado todas las alarmas pendientes.');
    this.emit('stopped');
  }

  setAlarm(minutes: number, message: string, customId?: string): string {
    this.assertCanSchedule(minutes);
    const id = customId || crypto.randomUUID();
    const ms = minutes * 60000;
    const timerId = setTimeout(() => void this.triggerAlarm(id, message), ms);

    this.alarms.set(id, { info: { id, triggerTime: Date.now() + ms, message }, timerId });
    console.log(`[PcAlarmService] Alarma programada con ID [${id}] para dentro de ${minutes} minuto(s).`);
    this.emit('alarm_set', this.alarms.get(id)?.info);
    return id;
  }

  cancelAlarm(id: string): boolean {
    const alarmData = this.alarms.get(id);
    if (!alarmData) {
      console.warn(`[PcAlarmService] Intento de cancelar una alarma inexistente o ya ejecutada: ${id}`);
      return false;
    }

    clearTimeout(alarmData.timerId);
    this.alarms.delete(id);
    console.log(`[PcAlarmService] Alarma cancelada correctamente: ${id}`);
    this.emit('alarm_cancelled', { id });
    return true;
  }

  getStatus(): AlarmStatus {
    const alarms: AlarmInfo[] = Array.from(this.alarms.values()).map((data) => data.info);
    return { activeAlarms: this.alarms.size, alarms, isRunning: this.isRunning };
  }

  getConfig(): AlarmConfig {
    return this.config;
  }

  private assertCanSchedule(minutes: number): void {
    if (!this.isRunning) throw new Error('El servicio de alarmas no esta en ejecucion. Llama a start() primero.');
    if (minutes <= 0) throw new Error('El tiempo de la alarma debe ser mayor a 0 minutos.');
  }

  private async triggerAlarm(id: string, message: string): Promise<void> {
    console.log(`[PcAlarmService] Disparando alarma ID: ${id}, Mensaje: "${message}"`);
    try {
      await triggerNativeAlarm(message, this.config.defaultSoundDuration);
    } catch (error) {
      console.error(`[PcAlarmService] Fallo al ejecutar la alarma ${id}:`, error);
    } finally {
      this.alarms.delete(id);
      this.emit('alarm_triggered', { id, message });
    }
  }
}
