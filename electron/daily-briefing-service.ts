import { EventEmitter } from 'node:events';
import cron, { type ScheduledTask } from 'node-cron';
import type { WhatsAppService } from './whatsapp-service';
import { generateBriefingSummary } from './daily-briefing/gemini';
import { collectDailyBriefingSystemData } from './daily-briefing/system-data';
import { sendDailyBriefingWhatsApp } from './daily-briefing/whatsapp';
import type { DailyBriefingConfig, DailyBriefingStatus } from './daily-briefing/types';

export type { DailyBriefingConfig, DailyBriefingStatus } from './daily-briefing/types';

export class DailyBriefingService extends EventEmitter {
  private config: DailyBriefingConfig;
  private task: ScheduledTask | null = null;
  private waService: WhatsAppService;
  private isRunning = false;
  private lastRun?: Date;

  constructor(config: DailyBriefingConfig, waService: WhatsAppService) {
    super();
    this.config = config;
    this.waService = waService;
  }

  async init(): Promise<void> {
    console.log('[DailyBriefing] Inicializando servicio...');
  }

  async start(): Promise<void> {
    this.task?.stop();
    if (!this.config.enabled || !this.config.ownerNumber || !this.config.apiKey) {
      console.log('[DailyBriefing] Servicio deshabilitado o falta configuracion basica.');
      return;
    }

    this.isRunning = true;
    const scheduleStr = this.config.schedule || '0 8 * * 1-5';
    this.task = cron.schedule(scheduleStr, async () => {
      console.log('[DailyBriefing] Ejecutando rutina de briefing diario programada...');
      await this.runBriefing();
    });
    console.log(`[DailyBriefing] Servicio iniciado con horario: ${scheduleStr}`);
    this.emit('started');
  }

  async stop(): Promise<void> {
    if (this.task) {
      this.task.stop();
      this.task = null;
    }
    this.isRunning = false;
    console.log('[DailyBriefing] Servicio detenido.');
    this.emit('stopped');
  }

  getStatus(): DailyBriefingStatus {
    return { isRunning: this.isRunning, lastRun: this.lastRun, config: this.config };
  }

  getConfig(): DailyBriefingConfig {
    return this.config;
  }

  updateConfig(newConfig: Partial<DailyBriefingConfig>): void {
    this.config = { ...this.config, ...newConfig };
    if (this.isRunning) this.start();
  }

  async runNow(): Promise<void> {
    if (!this.config.apiKey || !this.config.ownerNumber) {
      throw new Error('Falta configuracion requerida (apiKey o ownerNumber) para ejecutar el briefing.');
    }
    await this.runBriefing();
  }

  private async runBriefing(): Promise<void> {
    try {
      this.lastRun = new Date();
      const systemData = collectDailyBriefingSystemData();
      const summary = await generateBriefingSummary(this.config.apiKey, systemData);
      const sent = await sendDailyBriefingWhatsApp(this.waService, this.config.ownerNumber, summary);

      this.emit('briefing-sent', sent
        ? { success: true, to: this.config.ownerNumber }
        : { success: false, error: 'WhatsApp desconectado' });
    } catch (err: any) {
      console.error('[DailyBriefing] Error general en la ejecucion del briefing diario:', err.message);
      this.emit('briefing-error', err);
    }
  }
}
