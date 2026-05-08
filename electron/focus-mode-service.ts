import { EventEmitter } from 'node:events';
import type { CalendarService } from './calendar-service';
import { muteSystemAudio, restoreSystemAudio } from './focus-mode/audio';
import { createCalendarFocusEvent, finishCalendarEventEarly } from './focus-mode/calendar';
import type { SmartFocusConfig, SmartFocusStatus } from './focus-mode/types';
export type { SmartFocusConfig, SmartFocusStatus } from './focus-mode/types';
export class SmartFocusService extends EventEmitter {
  private config: SmartFocusConfig;
  private status: SmartFocusStatus;
  private timerId?: NodeJS.Timeout;
  private calendarService?: CalendarService;
  constructor(config: SmartFocusConfig = {}) {
    super();
    this.config = config;
    this.status = { active: false };
  }
  setCalendarService(calendar: CalendarService): void {
    this.calendarService = calendar;
    console.log('[SmartFocus] Servicio de Calendario vinculado.');
  }
  async init(): Promise<void> {
    console.log('[SmartFocus] Servicio inicializado correctamente.');
  }
  async start(): Promise<void> {
    console.log('[SmartFocus] Servicio iniciado y listo para recibir comandos.');
  }
  async stop(): Promise<void> {
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = undefined;
    }
    if (this.status.active) {
      await this.deactivateFocusMode(true);
    }
    console.log('[SmartFocus] Servicio detenido.');
  }
  getStatus(): SmartFocusStatus {
    return this.status;
  }
  getConfig(): SmartFocusConfig {
    return this.config;
  }
  async activateFocusMode(minutes: number): Promise<{ success: boolean; error?: string }> {
    if (this.status.active) {
      return { success: false, error: 'El Modo Concentracion ya se encuentra activo.' };
    }
    try {
      console.log(`[SmartFocus] Iniciando Modo Concentracion por ${minutes} minutos...`);
      await muteSystemAudio();
      const startTime = new Date();
      const endTime = new Date(startTime.getTime() + minutes * 60000);
      const eventId = await createCalendarFocusEvent(this.calendarService, startTime, endTime);
      this.status = { active: true, minutes, endTime, eventId };
      this.timerId = setTimeout(async () => {
        console.log('[SmartFocus] Temporizador finalizado. Restaurando estado normal...');
        await this.deactivateFocusMode(true);
      }, minutes * 60000);
      this.emit('focus-mode-started', this.status);
      console.log(`[SmartFocus] Modo Concentracion activado exitosamente por ${minutes} minutos.`);
      return { success: true };
    } catch (error: any) {
      console.error(`[SmartFocus] Error activando Modo Concentracion: ${error.message}`);
      await restoreSystemAudio().catch(() => {});
      return { success: false, error: error.message };
    }
  }

  async deactivateFocusMode(isAuto: boolean = false): Promise<{ success: boolean; error?: string }> {
    if (!this.status.active) {
      return { success: false, error: 'El Modo Concentracion no esta activo.' };
    }
    try {
      if (this.timerId && !isAuto) {
        clearTimeout(this.timerId);
        this.timerId = undefined;
      }
      await restoreSystemAudio();
      await finishCalendarEventEarly(this.calendarService, this.status, isAuto);
      const completedStatus = { ...this.status, active: false };
      this.status = { active: false };
      this.emit('focus-mode-ended', completedStatus);
      console.log('[SmartFocus] Modo Concentracion desactivado correctamente.');
      return { success: true };
    } catch (error: any) {
      console.error(`[SmartFocus] Error desactivando Modo Concentracion: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
}
