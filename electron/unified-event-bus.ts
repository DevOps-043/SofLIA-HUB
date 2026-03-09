import { EventEmitter } from 'node:events';
import * as os from 'node:os';

export class SystemEventBus extends EventEmitter {
  private dndUntil: number | null = null;
  private thresholds: Record<string, number> = { cpu: 90, mem: 90, disk: 95 };
  private intervalId?: NodeJS.Timeout;
  private lastCpuInfo = os.cpus();

  constructor() {
    super();
  }

  async init(): Promise<void> {
    console.log('[SystemEventBus] Initialized.');
  }

  async start(): Promise<void> {
    if (this.intervalId) return;
    
    this.lastCpuInfo = os.cpus();

    // Check every 5 minutes (300000 ms)
    this.intervalId = setInterval(() => {
      this.checkSystemResources().catch(err => {
        console.error('[SystemEventBus] Error checking system resources:', err);
      });
    }, 300000);
    
    // Initial check (delayed slightly to get a meaningful CPU diff)
    setTimeout(() => {
      this.checkSystemResources().catch(() => {});
    }, 1000);
    console.log('[SystemEventBus] Started resource monitoring.');
  }

  async stop(): Promise<void> {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    console.log('[SystemEventBus] Stopped resource monitoring.');
  }

  public setThresholds(newThresholds: Partial<Record<string, number>>): void {
    const updated = { ...this.thresholds };
    for (const key in newThresholds) {
      const val = newThresholds[key];
      if (val !== undefined) {
        updated[key] = val;
      }
    }
    this.thresholds = updated;
  }

  public getThresholds(): Record<string, number> {
    return { ...this.thresholds };
  }

  public setDnd(hours: number): void {
    if (hours <= 0) {
      this.dndUntil = null;
    } else {
      this.dndUntil = Date.now() + hours * 3600 * 1000;
    }
  }

  public getDndStatus(): { active: boolean; until: Date | null } {
    if (this.dndUntil && Date.now() < this.dndUntil) {
      return { active: true, until: new Date(this.dndUntil) };
    }
    return { active: false, until: null };
  }

  public getStatus(): Record<string, any> {
    const dnd = this.getDndStatus();
    return {
      active: !!this.intervalId,
      thresholds: this.thresholds,
      dndActive: dnd.active,
      dndUntil: dnd.until,
    };
  }

  public getConfig(): Record<string, any> {
    return {
      thresholds: this.thresholds,
    };
  }

  private getCpuUsage(): number {
    const currentCpuInfo = os.cpus();
    let idleDiff = 0;
    let totalDiff = 0;

    for (let i = 0; i < currentCpuInfo.length; i++) {
      const current = currentCpuInfo[i].times;
      if (!this.lastCpuInfo[i]) continue;
      
      const last = this.lastCpuInfo[i].times;

      const currentTotal = current.user + current.nice + current.sys + current.idle + current.irq;
      const lastTotal = last.user + last.nice + last.sys + last.idle + last.irq;

      totalDiff += currentTotal - lastTotal;
      idleDiff += current.idle - last.idle;
    }

    this.lastCpuInfo = currentCpuInfo;

    if (totalDiff === 0) return 0;
    return 100 - (100 * idleDiff / totalDiff);
  }

  private async checkSystemResources(): Promise<void> {
    // If DND is active, skip emitting alerts
    if (this.dndUntil && Date.now() < this.dndUntil) {
      return;
    }

    try {
      const cpuUsage = this.getCpuUsage();
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;
      const memPercent = (usedMem / totalMem) * 100;

      const alerts: string[] = [];

      // Check CPU
      if (cpuUsage > this.thresholds.cpu) {
        alerts.push(`Uso de CPU alto: ${cpuUsage.toFixed(1)}% (umbral: ${this.thresholds.cpu}%)`);
      }

      // Check Memory
      if (memPercent > this.thresholds.mem) {
        alerts.push(`Uso de RAM alto: ${memPercent.toFixed(1)}% (umbral: ${this.thresholds.mem}%)`);
      }

      // Disk check is omitted because there is no direct equivalent in native Node 
      // without external libraries or complex cross-platform child_process commands.

      if (alerts.length > 0) {
        this.emit('system_alert', {
          timestamp: new Date(),
          alerts,
          summary: `Se detectaron ${alerts.length} alertas del sistema.`
        });
      }
    } catch (err) {
      console.error('[SystemEventBus] Failed to gather system information:', err);
    }
  }
}

export const systemEventBus = new SystemEventBus();

export const configureSystemAlertsTool = {
  name: 'configure_system_alerts',
  description: 'Permite configurar los umbrales de alerta del sistema (CPU, Memoria, Disco) o establecer un modo No Molestar (DND) por un número de horas.',
  
  inputSchema: {
    type: 'object',
    properties: {
      cpu: { type: 'number', description: 'Umbral de alerta para CPU en porcentaje (ej. 90).' },
      mem: { type: 'number', description: 'Umbral de alerta para Memoria en porcentaje (ej. 90).' },
      disk: { type: 'number', description: 'Umbral de alerta para Disco en porcentaje (ej. 95).' },
      dndHours: { type: 'number', description: 'Número de horas para silenciar las alertas (Modo No Molestar). Usa 0 para desactivar DND.' }
    }
  },

  handler: async (args: any) => {
    try {
      let message = 'Configuración de alertas actualizada:\n';
      
      if (args.cpu !== undefined || args.mem !== undefined || args.disk !== undefined) {
        const newThresholds: any = {};
        if (args.cpu !== undefined) newThresholds.cpu = args.cpu;
        if (args.mem !== undefined) newThresholds.mem = args.mem;
        if (args.disk !== undefined) newThresholds.disk = args.disk;
        
        systemEventBus.setThresholds(newThresholds);
        message += `- Umbrales modificados: ${JSON.stringify(newThresholds)}\n`;
      }

      if (args.dndHours !== undefined) {
        systemEventBus.setDnd(args.dndHours);
        if (args.dndHours > 0) {
          message += `- Modo No Molestar activado por ${args.dndHours} horas.\n`;
        } else {
          message += `- Modo No Molestar desactivado.\n`;
        }
      }

      if (args.cpu === undefined && args.mem === undefined && args.disk === undefined && args.dndHours === undefined) {
        const status = systemEventBus.getStatus();
        return { 
          success: true, 
          message: 'No se realizaron cambios. Estado actual:\n' + JSON.stringify(status, null, 2) 
        };
      }

      return { success: true, message: message.trim() };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
};
