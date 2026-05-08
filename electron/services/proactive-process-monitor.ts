import { EventEmitter } from 'node:events';
import type { WhatsAppService } from '../whatsapp-service';
import { calculateCpuUsage } from './proactive-process-monitor/cpu-usage';
import { registerProcessMonitorIpc } from './proactive-process-monitor/ipc';
import { sendProcessAlert } from './proactive-process-monitor/alerts';
import type { ProcessState, ProactiveMonitorConfig } from './proactive-process-monitor/types';

export type { ProactiveMonitorConfig } from './proactive-process-monitor/types';

export class ProactiveProcessMonitor extends EventEmitter {
  private config: ProactiveMonitorConfig;
  private intervalId?: NodeJS.Timeout;
  private processMap = new Map<number, ProcessState>();
  private waService: WhatsAppService | null = null;

  constructor(config?: Partial<ProactiveMonitorConfig>) {
    super();
    this.config = {
      enabled: true,
      checkIntervalMs: 2 * 60 * 1000,
      cpuThresholdPercent: 90.0,
      consecutiveChecksToAlert: 3,
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
    registerProcessMonitorIpc(this.processMap, (pid) => this.killProcess(pid));
    console.log('[ProactiveProcessMonitor] Initialized (Stub)');
  }

  start(): void {
    if (this.intervalId || !this.config.enabled) return;
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
    return { running: !!this.intervalId, trackedProcesses: this.processMap.size, config: this.config };
  }

  getConfig(): ProactiveMonitorConfig {
    return this.config;
  }

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

  private async checkProcesses() {
    const cpuUsage = calculateCpuUsage();
    if (cpuUsage < this.config.cpuThresholdPercent) {
      this.processMap.delete(0);
      return;
    }

    const existing = this.processMap.get(0);
    if (!existing) {
      this.processMap.set(0, { name: 'Sistema (global)', consecutiveHighCpu: 1, lastMem: cpuUsage });
      return;
    }

    existing.consecutiveHighCpu += 1;
    if (existing.consecutiveHighCpu >= this.config.consecutiveChecksToAlert) {
      await this.triggerAlert(0, existing);
      this.processMap.delete(0);
    }
  }

  private async triggerAlert(pid: number, state: ProcessState) {
    await sendProcessAlert({ pid, state, config: this.config, waService: this.waService, emit: this.emit.bind(this) });
  }
}
