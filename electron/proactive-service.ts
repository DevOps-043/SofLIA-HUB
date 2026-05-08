import { EventEmitter } from 'node:events';
import { collectProactiveData } from './proactive/data-collector';
import { loadProactiveConfig, saveProactiveConfig } from './proactive/config';
import { runProactiveTick } from './proactive/tick-runner';
import { triggerProactiveNow } from './proactive/trigger-now';
import type { ProactiveConfig, ProactiveRuntimeContext } from './proactive/types';

export class ProactiveService extends EventEmitter {
  private config: ProactiveConfig = loadProactiveConfig();
  private checkInterval: NodeJS.Timeout | null = null;
  private lastNotifiedHours: Map<string, Set<number>> = new Map();
  private lastNotifiedDate = '';
  private calendarService: any = null;
  private waService: any = null;
  private apiKey = '';

  setCalendarService(calService: any): void { this.calendarService = calService; }
  setWhatsAppService(waService: any): void { this.waService = waService; }
  setApiKey(key: string): void { this.apiKey = key; }
  getConfig(): ProactiveConfig { return { ...this.config }; }

  updateConfig(updates: Partial<ProactiveConfig>): void {
    this.config = { ...this.config, ...updates };
    saveProactiveConfig(this.config);
    console.log('[ProactiveService] Config updated:', this.config);
    if (this.checkInterval) {
      this.stop();
      this.start();
    }
  }

  start(): void {
    if (this.checkInterval) return;
    if (!this.config.enabled) {
      console.log('[ProactiveService] Disabled — not starting.');
      return;
    }
    const intervalMs = this.config.checkIntervalMinutes * 60 * 1000;
    console.log(`[ProactiveService] Starting — checking every ${this.config.checkIntervalMinutes} min, notification hours: ${this.config.notificationHours.join(', ')}`);
    this.checkInterval = setInterval(() => this.tick(), intervalMs);
    setTimeout(() => this.tick(), 5000);
  }

  stop(): void {
    if (!this.checkInterval) return;
    clearInterval(this.checkInterval);
    this.checkInterval = null;
    console.log('[ProactiveService] Stopped.');
  }

  isRunning(): boolean { return this.checkInterval !== null; }

  async triggerNow(phoneNumber?: string): Promise<{ success: boolean; message?: string; error?: string }> {
    return triggerProactiveNow(this.buildRuntimeContext(), phoneNumber);
  }

  private async tick(): Promise<void> {
    await runProactiveTick(this.buildRuntimeContext());
  }

  async collectData(session: any) {
    return collectProactiveData(this.buildRuntimeContext(), session);
  }

  private buildRuntimeContext(): ProactiveRuntimeContext {
    return {
      config: this.config,
      calendarService: this.calendarService,
      waService: this.waService,
      apiKey: this.apiKey,
      lastNotifiedHours: this.lastNotifiedHours,
      getLastNotifiedDate: () => this.lastNotifiedDate,
      setLastNotifiedDate: (date) => { this.lastNotifiedDate = date; },
      emit: (event, payload) => this.emit(event, payload),
    };
  }
}
