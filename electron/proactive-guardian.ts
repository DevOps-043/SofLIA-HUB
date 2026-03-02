import { EventEmitter } from 'node:events';
import os from 'node:os';
import { execSync } from 'node:child_process';

export interface GuardianConfig {
  cpuThreshold: number; // Por defecto 90%
  checkIntervalMs: number; // Por defecto 5 minutos (300000 ms)
  consecutiveAlertThreshold: number; // Por defecto 2 chequeos consecutivos
}

export interface GuardianStatus {
  isRunning: boolean;
  lastCheckTime: Date | null;
  currentCpuUsage: number;
  consecutiveHighCpu: number;
}

export interface GuardianAlert {
  type: string;
  cpuUsage: number;
  processName: string;
  processInfo: string;
  message: string;
}

/**
 * ProactiveGuardianService
 * Monitor de sistema en segundo plano que genera alertas proactivas.
 * Emite eventos 'alert' que pueden ser capturados por WhatsAppService.
 */
export class ProactiveGuardianService extends EventEmitter {
  private config: GuardianConfig;
  private intervalId?: NodeJS.Timeout;
  private status: GuardianStatus;
  
  private lastCpuInfo: { idle: number; total: number } | null = null;

  constructor(config?: Partial<GuardianConfig>) {
    super();
    this.config = {
      cpuThreshold: config?.cpuThreshold ?? 90,
      checkIntervalMs: config?.checkIntervalMs ?? 5 * 60 * 1000,
      consecutiveAlertThreshold: config?.consecutiveAlertThreshold ?? 2,
    };
    this.status = {
      isRunning: false,
      lastCheckTime: null,
      currentCpuUsage: 0,
      consecutiveHighCpu: 0,
    };
  }

  async init(): Promise<void> {
    this.lastCpuInfo = this.getCpuInfo();
    console.log('[Proactive Guardian] Inicializado con config:', this.config);
  }

  async start(): Promise<void> {
    if (this.status.isRunning) return;
    
    this.status.isRunning = true;
    this.lastCpuInfo = this.getCpuInfo();
    
    // Iniciar polling
    this.intervalId = setInterval(() => this.checkSystemHealth(), this.config.checkIntervalMs);
    console.log(`[Proactive Guardian] Servicio iniciado. Intervalo: ${this.config.checkIntervalMs}ms`);
  }

  async stop(): Promise<void> {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    this.status.isRunning = false;
    console.log('[Proactive Guardian] Servicio detenido.');
  }

  getStatus(): GuardianStatus {
    return { ...this.status };
  }

  getConfig(): GuardianConfig {
    return { ...this.config };
  }

  private getCpuInfo(): { idle: number; total: number } {
    const cpus = os.cpus();
    let idle = 0;
    let total = 0;

    for (const cpu of cpus) {
      for (const type in cpu.times) {
        total += cpu.times[type as keyof typeof cpu.times];
      }
      idle += cpu.times.idle;
    }

    return { idle, total };
  }

  private checkSystemHealth(): void {
    this.status.lastCheckTime = new Date();
    const currentCpuInfo = this.getCpuInfo();
    
    if (!this.lastCpuInfo) {
      this.lastCpuInfo = currentCpuInfo;
      return;
    }

    const idleDifference = currentCpuInfo.idle - this.lastCpuInfo.idle;
    const totalDifference = currentCpuInfo.total - this.lastCpuInfo.total;

    if (totalDifference === 0) {
      this.lastCpuInfo = currentCpuInfo;
      return;
    }

    const cpuUsage = 100 - Math.floor((100 * idleDifference) / totalDifference);
    this.status.currentCpuUsage = cpuUsage;
    this.lastCpuInfo = currentCpuInfo;

    if (cpuUsage >= this.config.cpuThreshold) {
      this.status.consecutiveHighCpu += 1;
      
      if (this.status.consecutiveHighCpu >= this.config.consecutiveAlertThreshold) {
        console.warn(`[Proactive Guardian] ⚠️ Uso de CPU por encima de ${this.config.cpuThreshold}% durante ${this.status.consecutiveHighCpu} chequeos.`);
        this.triggerHighCpuAlert(cpuUsage);
        // Resetear contador después de alertar para evitar spam
        this.status.consecutiveHighCpu = 0;
      }
    } else {
      this.status.consecutiveHighCpu = 0;
    }
  }

  private triggerHighCpuAlert(cpuUsage: number): void {
    try {
      const isWindows = os.platform() === 'win32';
      let processInfo = 'Desconocido';
      let processName = 'Desconocido';

      if (isWindows) {
        // En Windows usamos powershell para obtener el proceso que consume más CPU, excluyendo 'Idle'
        const cmd = `powershell -NoProfile -Command "Get-Process | Where-Object { $_.Name -notmatch 'Idle' } | Sort-Object CPU -Descending | Select-Object -First 1 ProcessName, Id | ConvertTo-Json -Compress"`;
        const output = execSync(cmd, { encoding: 'utf-8', timeout: 10000, windowsHide: true });
        if (output.trim()) {
          const proc = JSON.parse(output.trim());
          processName = proc.ProcessName;
          processInfo = `${proc.ProcessName} (PID: ${proc.Id})`;
        }
      } else {
        // En Mac / Linux usamos ps
        const cmd = `ps -eo pcpu,pid,comm | sort -k 1 -n -r | head -n 2 | tail -n 1`;
        const output = execSync(cmd, { encoding: 'utf-8', timeout: 10000 });
        if (output.trim()) {
          const parts = output.trim().split(/\s+/);
          if (parts.length >= 3) {
            processName = parts.slice(2).join(' '); // El comando podría tener espacios
            processInfo = `${processName} (PID: ${parts[1]})`;
          }
        }
      }

      const alertMessage = `⚠️ SofLIA Alerta: Tu equipo está lento. El proceso ${processName} está consumiendo ${cpuUsage}% de CPU. Responde MATAR ${processName} para detenerlo.`;
      
      console.log('[Proactive Guardian] Disparando alerta de sistema:', alertMessage);
      
      const alert: GuardianAlert = {
        type: 'high_cpu',
        cpuUsage,
        processName,
        processInfo,
        message: alertMessage,
      };

      // Disparar evento interno para que pueda ser enviado a WhatsApp
      this.emit('alert', alert);

    } catch (err: any) {
      console.error('[Proactive Guardian] Error al obtener información del proceso:', err.message);
      // Fallback si falla la recolección del nombre de proceso
      const fallbackMessage = `⚠️ SofLIA Alerta: Tu equipo está lento. El uso global de CPU está al ${cpuUsage}%.`;
      this.emit('alert', {
        type: 'high_cpu',
        cpuUsage,
        processName: 'Desconocido',
        processInfo: 'Desconocido',
        message: fallbackMessage,
      });
    }
  }
}
