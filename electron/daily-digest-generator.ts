import { app } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import type { WhatsAppService } from './whatsapp-service';
import type { DailyDigestConfig } from './daily-digest/types';
import { buildDailyDigestHtml } from './daily-digest/html';
import { collectDailyDigestStats } from './daily-digest/system-stats';
import { renderHtmlToPdf } from './daily-digest/pdf-renderer';

export type { DailyDigestConfig } from './daily-digest/types';
export { registerDailyDigestHandlers } from './daily-digest/handlers';
export { WhatsAppDailyDigestTool } from './daily-digest/whatsapp-tool';

export class DailyDigestGenerator extends EventEmitter {
  private waService: WhatsAppService | null;
  private config: DailyDigestConfig = {
    phoneNumber: '',
    scheduleHour: 18,
    scheduleMinute: 0,
    enabled: false,
  };
  private intervalId?: NodeJS.Timeout;

  constructor(waService: WhatsAppService | null = null) {
    super();
    this.waService = waService;
  }

  async init(): Promise<void> {
    const configPath = path.join(app.getPath('userData'), 'daily-digest-config.json');
    try {
      this.config = { ...this.config, ...JSON.parse(await fs.readFile(configPath, 'utf-8')) };
    } catch {}

    if (this.config.enabled) this.start();
  }

  async updateConfig(newConfig: Partial<DailyDigestConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig };
    const configPath = path.join(app.getPath('userData'), 'daily-digest-config.json');
    await fs.writeFile(configPath, JSON.stringify(this.config, null, 2), 'utf-8');
    if (this.config.enabled) this.start();
    else this.stop();
  }

  start(): void {
    this.stop();
    this.intervalId = setInterval(() => void this.runScheduledTick(), 60000);
    console.log(`[DailyDigest] Servicio programado a las ${this.config.scheduleHour}:${this.config.scheduleMinute.toString().padStart(2, '0')}`);
  }

  stop(): void {
    if (!this.intervalId) return;
    clearInterval(this.intervalId);
    this.intervalId = undefined;
    console.log('[DailyDigest] Servicio detenido.');
  }

  async generateAndSend(phoneNumber: string): Promise<string> {
    const pdfBuffer = await this.generatePDF();
    const reportsDir = path.join(app.getPath('userData'), 'reports');
    await fs.mkdir(reportsDir, { recursive: true });

    const dateStr = new Date().toISOString().split('T')[0];
    const filePath = path.join(reportsDir, `SofLIA_Ejecutivo_${dateStr}.pdf`);
    await fs.writeFile(filePath, pdfBuffer);
    await this.sendReportIfConnected(phoneNumber, filePath, dateStr);
    return filePath;
  }

  async generatePDF(): Promise<Buffer> {
    const stats = await collectDailyDigestStats(app.getPath('userData'));
    return renderHtmlToPdf(buildDailyDigestHtml(stats));
  }

  getStatus() {
    return {
      enabled: this.config.enabled,
      schedule: `${this.config.scheduleHour.toString().padStart(2, '0')}:${this.config.scheduleMinute.toString().padStart(2, '0')}`,
      phoneNumber: this.config.phoneNumber,
    };
  }

  getConfig() {
    return this.config;
  }

  private async runScheduledTick(): Promise<void> {
    if (!this.config.enabled || !this.config.phoneNumber) return;
    const now = new Date();
    if (now.getHours() !== this.config.scheduleHour || now.getMinutes() !== this.config.scheduleMinute) return;
    this.stop();
    try {
      await this.generateAndSend(this.config.phoneNumber);
    } catch (err) {
      console.error('[DailyDigest] Error generando reporte programado:', err);
    }
    setTimeout(() => this.start(), 61000);
  }

  private async sendReportIfConnected(phoneNumber: string, filePath: string, dateStr: string): Promise<void> {
    if (!this.waService?.isConnected()) {
      console.log(`[DailyDigest] WhatsApp no conectado. Reporte guardado localmente en ${filePath}`);
      return;
    }

    const jid = `${phoneNumber.replace(/\D/g, '')}@s.whatsapp.net`;
    const caption = `Reporte Ejecutivo Semanal de Pulse - ${dateStr}\n\nResumen automatizado del estado del sistema, rendimiento de hardware y actividades recientes de AutoDev.`;
    await this.waService.sendFile(jid, filePath, caption);
    this.emit('sent', { filePath, phoneNumber });
    console.log(`[DailyDigest] Reporte enviado exitosamente a ${phoneNumber}`);
  }
}
