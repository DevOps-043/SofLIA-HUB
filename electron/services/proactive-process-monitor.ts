import { EventEmitter } from 'node:events';
import { ipcMain } from 'electron';
import os from 'node:os';
import type { WhatsAppService } from '../whatsapp-service';

export interface ProactiveMonitorConfig {
  enabled: boolean;
  checkIntervalMs: number;
  cpuThresholdPercent: number;
  consecutiveChecksToAlert: number;
  notifyPhone: string | null;
}

interface ProcessState {
  name: string;
  consecutiveHighCpu: number;
  lastMem: number;
}

export class ProactiveProcessMonitor extends EventEmitter {
  private config: ProactiveMonitorConfig;
  private intervalId?: NodeJS.Timeout;
  private processMap = new Map<number, ProcessState>();
  private waService: WhatsAppService | null = null;
  
  constructor(config?: Partial<ProactiveMonitorConfig>) {
    super();
    this.config = {
      enabled: true,
      checkIntervalMs: 2 * 60 * 1000, // 2 minutos
      cpuThresholdPercent: 90.0,
      consecutiveChecksToAlert: 3, // 6 minutos total en 3 chequeos consecutivos
      notifyPhone: null,
      ...config,
    };
  }

  setWhatsAppService(waService: WhatsAppService) {
    this.waService = waService;
  }

  updateConfig(newConfig: Partial<ProactiveMonitorConfig>) {
    this.config = { ...this.config, ...newConfig };
    if (this.intervalId) {
      this.stop();
      if (this.config.enabled) this.start();
    }
  }

  async init(): Promise<void> {
    this.initIpc();
    console.log('[ProactiveProcessMonitor] Initialized (Stub)');
  }

  start(): void {
    if (this.intervalId) return;
    if (!this.config.enabled) return;
    
    console.log(`[ProactiveProcessMonitor] Starting interval: ${this.config.checkIntervalMs}ms (Stub)`);
    this.intervalId = setInterval(() => this.checkProcesses(), this.config.checkIntervalMs);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
      console.log('[ProactiveProcessMonitor] Stopped (Stub)');
    }
    this.processMap.clear();
  }

  getStatus() {
    return {
      running: !!this.intervalId,
      trackedProcesses: this.processMap.size,
      config: this.config
    };
  }

  getConfig(): ProactiveMonitorConfig {
    return this.config;
  }

  /**
   * Mata un proceso por su PID localmente usando el comando de Node.js.
   * Sirve como canal de respuesta para el evento de forzar cierre.
   */
  killProcess(pid: number): boolean {
    try {
      process.kill(pid, 'SIGKILL');
      this.processMap.delete(pid);
      console.log(`[ProactiveProcessMonitor] Killed process ${pid} successfully`);
      return true;
    } catch (err: any) {
      console.error(`[ProactiveProcessMonitor] Failed to kill process ${pid}:`, err.message);
      return false;
    }
  }

  private initIpc() {
    // IPC Handlers para interactuar con la interfaz del sistema
    ipcMain.handle('proactive:kill-process', async (_event, pid: number) => {
      try {
        const success = this.killProcess(pid);
        return { success };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    });

    ipcMain.handle('proactive:get-tracked-processes', async () => {
      return { 
        success: true, 
        processes: Array.from(this.processMap.entries()).map(([pid, state]) => ({ pid, ...state })) 
      };
    });
  }

  private async checkProcesses() {
    // Implementación ligera usando os.cpus() (sin dependencia de systeminformation)
    const cpus = os.cpus();
    let totalIdle = 0, totalTick = 0;
    for (const cpu of cpus) {
      for (const type in cpu.times) {
        totalTick += cpu.times[type as keyof typeof cpu.times];
      }
      totalIdle += cpu.times.idle;
    }
    const cpuUsage = 100 - Math.floor((100 * totalIdle) / totalTick);

    if (cpuUsage >= this.config.cpuThresholdPercent) {
      // Usamos PID 0 como indicador de carga global del sistema
      const pid = 0;
      const existing = this.processMap.get(pid);
      if (existing) {
        existing.consecutiveHighCpu += 1;
        if (existing.consecutiveHighCpu >= this.config.consecutiveChecksToAlert) {
          await this.triggerAlert(pid, existing);
          this.processMap.delete(pid);
        }
      } else {
        this.processMap.set(pid, { name: 'Sistema (global)', consecutiveHighCpu: 1, lastMem: cpuUsage });
      }
    } else {
      this.processMap.delete(0);
    }
  }

  private async triggerAlert(pid: number, state: ProcessState) {
    const minutes = (this.config.consecutiveChecksToAlert * this.config.checkIntervalMs) / 60000;
    const alertMsg = `⚠️ *Alerta de Rendimiento*\nEl proceso *${state.name}* (PID: ${pid}) lleva ${minutes} minutos consumiendo más del ${this.config.cpuThresholdPercent}% de CPU y ${state.lastMem.toFixed(1)}% de memoria.\n\n¿Deseas forzar el cierre? Responde: "Cierra el proceso ${pid}" o "Mata el proceso ${state.name}".`;
    
    console.log(`[ProactiveProcessMonitor] ALERT: ${alertMsg.replace(/\n/g, ' ')}`);
    this.emit('alert', { pid, name: state.name, message: alertMsg });

    if (this.waService) {
      const status = this.waService.getStatus();
      if (status.connected) {
        try {
          // Priorizar el número configurado, sino recurrir a los números permitidos globalmente en WhatsAppAgent
          let targetPhone = this.config.notifyPhone;
          if (!targetPhone && status.allowedNumbers && status.allowedNumbers.length > 0) {
            targetPhone = status.allowedNumbers[0];
          }

          if (targetPhone) {
            const cleanNumber = targetPhone.replace(/[^0-9]/g, '');
            const jid = `${cleanNumber}@s.whatsapp.net`;
            await this.waService.sendText(jid, alertMsg);
            
            // Nota: Si el usuario responde "Cierra el proceso X", el Agente de SofLIA 
            // usará automáticamente su herramienta NLP 'kill_process' para resolverlo, 
            // que a su vez se complementa con la confirmación previa.
          } else {
            console.warn('[ProactiveProcessMonitor] No target phone configured to send WhatsApp alert');
          }
        } catch (err: any) {
          console.error('[ProactiveProcessMonitor] Failed to send WhatsApp alert:', err.message);
        }
      }
    }
  }
}
