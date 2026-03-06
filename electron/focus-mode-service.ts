import { EventEmitter } from 'node:events';
import { exec } from 'node:child_process';
import os from 'node:os';
import util from 'node:util';
import type { CalendarService } from './calendar-service';

const execPromise = util.promisify(exec);

export interface SmartFocusConfig {
  defaultMinutes?: number;
}

export interface SmartFocusStatus {
  active: boolean;
  endTime?: Date;
  eventId?: string;
  minutes?: number;
}

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

  /**
   * Silencia el volumen del sistema operativo de forma nativa.
   * Utiliza comandos específicos por plataforma con manejo de errores y fallbacks.
   */
  private async muteSystemAudio(): Promise<void> {
    const platform = os.platform();
    try {
      if (platform === 'win32') {
        try {
          // Intento primario con nircmd si está instalado
          await execPromise('nircmd.exe mutesysvolume 1');
          console.log('[SmartFocus] Audio silenciado (Windows - nircmd).');
        } catch (err) {
          console.warn('[SmartFocus] nircmd no encontrado, usando fallback de PowerShell...', err);
          // Fallback nativo: toggle de mute vía SendKeys
          await execPromise('powershell -Command "$obj = new-object -com wscript.shell; $obj.SendKeys([char]173)"');
          console.log('[SmartFocus] Audio silenciado (Windows - PowerShell).');
        }
      } else if (platform === 'darwin') {
        await execPromise('osascript -e "set volume with output muted"');
        console.log('[SmartFocus] Audio silenciado (macOS).');
      } else if (platform === 'linux') {
        await execPromise('amixer -D pulse sset Master mute');
        console.log('[SmartFocus] Audio silenciado (Linux - ALSA/Pulse).');
      } else {
        console.warn(`[SmartFocus] Plataforma ${platform} no soportada para silenciar audio nativamente.`);
      }
    } catch (error: any) {
      console.error(`[SmartFocus] Error crítico al silenciar audio: ${error.message}`);
    }
  }

  /**
   * Restaura el volumen del sistema operativo de forma nativa.
   */
  private async restoreSystemAudio(): Promise<void> {
    const platform = os.platform();
    try {
      if (platform === 'win32') {
        try {
          await execPromise('nircmd.exe mutesysvolume 0');
          console.log('[SmartFocus] Audio restaurado (Windows - nircmd).');
        } catch (err) {
          console.warn('[SmartFocus] nircmd no encontrado, usando fallback de PowerShell...', err);
          await execPromise('powershell -Command "$obj = new-object -com wscript.shell; $obj.SendKeys([char]173)"');
          console.log('[SmartFocus] Audio restaurado (Windows - PowerShell).');
        }
      } else if (platform === 'darwin') {
        await execPromise('osascript -e "set volume without output muted"');
        console.log('[SmartFocus] Audio restaurado (macOS).');
      } else if (platform === 'linux') {
        await execPromise('amixer -D pulse sset Master unmute');
        console.log('[SmartFocus] Audio restaurado (Linux - ALSA/Pulse).');
      } else {
        console.warn(`[SmartFocus] Plataforma ${platform} no soportada para restaurar audio nativamente.`);
      }
    } catch (error: any) {
      console.error(`[SmartFocus] Error crítico al restaurar audio: ${error.message}`);
    }
  }

  /**
   * Activa el Modo Concentración.
   * Silencia el PC, marca el calendario como ocupado y configura un temporizador.
   */
  async activateFocusMode(minutes: number): Promise<{ success: boolean; error?: string }> {
    if (this.status.active) {
      return { success: false, error: 'El Modo Concentración ya se encuentra activo.' };
    }

    try {
      console.log(`[SmartFocus] Iniciando Modo Concentración por ${minutes} minutos...`);

      // 1. Silenciar audio del sistema
      await this.muteSystemAudio();

      const startTime = new Date();
      const endTime = new Date(startTime.getTime() + minutes * 60000);
      let eventId: string | undefined = undefined;

      // 2. Marcar como "Ocupado" en Google Calendar
      if (this.calendarService) {
        const result = await this.calendarService.createEvent({
          title: 'Modo Concentración - SofLIA',
          start: startTime,
          end: endTime,
          description: 'Sesión de trabajo enfocada generada automáticamente por SofLIA Hub. Por favor, no interrumpir.',
        });
        
        if (result.success && result.eventId) {
          eventId = result.eventId;
          console.log(`[SmartFocus] Evento creado en el calendario: ID ${eventId}`);
        } else {
          console.warn(`[SmartFocus] No se pudo crear evento en el calendario: ${result.error}`);
        }
      } else {
        console.warn('[SmartFocus] Servicio de calendario no disponible para registrar la sesión.');
      }

      // 3. Actualizar estado
      this.status = {
        active: true,
        minutes,
        endTime,
        eventId,
      };

      // 4. Iniciar temporizador para revertir cambios automáticamente
      this.timerId = setTimeout(async () => {
        console.log('[SmartFocus] Temporizador finalizado. Restaurando estado normal...');
        await this.deactivateFocusMode(true);
      }, minutes * 60000);

      this.emit('focus-mode-started', this.status);
      console.log(`[SmartFocus] Modo Concentración activado exitosamente por ${minutes} minutos.`);
      
      return { success: true };
    } catch (error: any) {
      console.error(`[SmartFocus] Error activando Modo Concentración: ${error.message}`);
      
      // Intentar revertir en caso de fallo crítico
      await this.restoreSystemAudio().catch(() => {});
      return { success: false, error: error.message };
    }
  }

  /**
   * Desactiva el Modo Concentración.
   * Restaura el audio, finaliza el evento de calendario si es necesario y dispara notificación.
   * @param isAuto Indica si la desactivación fue automática (por temporizador) o manual.
   */
  async deactivateFocusMode(isAuto: boolean = false): Promise<{ success: boolean; error?: string }> {
    if (!this.status.active) {
      return { success: false, error: 'El Modo Concentración no está activo.' };
    }

    try {
      // 1. Limpiar temporizador si se está desactivando manualmente
      if (this.timerId && !isAuto) {
        clearTimeout(this.timerId);
        this.timerId = undefined;
      }

      // 2. Restaurar audio del sistema
      await this.restoreSystemAudio();

      // 3. Ajustar evento de calendario si se finaliza antes de tiempo
      if (this.calendarService && this.status.eventId && !isAuto) {
        const now = new Date();
        if (this.status.endTime && now < this.status.endTime) {
          const result = await this.calendarService.updateEvent(this.status.eventId, { end: now });
          if (result.success) {
             console.log('[SmartFocus] Evento de calendario finalizado prematuramente con éxito.');
          } else {
             console.warn(`[SmartFocus] Fallo al actualizar evento de calendario: ${result.error}`);
          }
        }
      }

      const completedStatus = { ...this.status, active: false };
      
      // 4. Reiniciar estado interno
      this.status = { active: false };

      // 5. Despachar evento del sistema
      this.emit('focus-mode-ended', completedStatus);
      console.log('[SmartFocus] Modo Concentración desactivado correctamente.');

      return { success: true };
    } catch (error: any) {
      console.error(`[SmartFocus] Error desactivando Modo Concentración: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
}
