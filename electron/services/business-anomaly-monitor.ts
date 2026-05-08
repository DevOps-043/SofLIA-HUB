import { EventEmitter } from 'node:events';
import os from 'node:os';
import path from 'node:path';
import { getUpcomingMeetings } from './business-anomaly/calendar-events';
import { extractClientName } from './business-anomaly/client-name';
import { findProjectDirectory, hasPresentationFile } from './business-anomaly/project-files';
import { sendPresentationAlert } from './business-anomaly/notifications';
import type { AnomalyMonitorConfig, AnomalyMonitorStatus } from './business-anomaly/types';

export type { AnomalyMonitorConfig, AnomalyMonitorStatus } from './business-anomaly/types';

export class BusinessAnomalyMonitor extends EventEmitter {
  private intervalId: NodeJS.Timeout | null = null;
  private calendarService: any;
  private whatsappClient: any;
  private config: AnomalyMonitorConfig;
  private status: AnomalyMonitorStatus;
  private notifiedEvents: Set<string> = new Set();

  constructor(config?: Partial<AnomalyMonitorConfig>) {
    super();
    this.config = {
      checkIntervalMs: 3600000,
      alertThresholdMs: 7200000,
      ...config,
      projectsDir: config?.projectsDir || path.join(os.homedir(), 'Projects'),
    };
    this.status = { running: false, lastCheck: null, anomaliesDetected: 0 };
  }

  setCalendarService(calendarService: any): void {
    this.calendarService = calendarService;
  }

  setWhatsAppClient(whatsappClient: any): void {
    this.whatsappClient = whatsappClient;
  }

  async init(): Promise<void> {
    console.log('[BusinessAnomalyMonitor] Inicializado con config:', this.config);
  }

  start(): void {
    if (this.status.running) return;

    this.checkAnomalies().catch((err) => console.error('[BusinessAnomalyMonitor] Error en chequeo inicial:', err.message));
    this.intervalId = setInterval(async () => {
      await this.checkAnomalies();
    }, this.config.checkIntervalMs);

    this.status.running = true;
    this.emit('started');
    console.log('[BusinessAnomalyMonitor] Monitoreo de anomalias de negocio iniciado');
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.status.running = false;
    this.emit('stopped');
    console.log('[BusinessAnomalyMonitor] Monitoreo detenido');
  }

  getStatus(): AnomalyMonitorStatus {
    return { ...this.status };
  }

  getConfig(): AnomalyMonitorConfig {
    return { ...this.config };
  }

  startMonitor = (whatsappClient: any) => {
    this.setWhatsAppClient(whatsappClient);
    this.start();
  };

  stopMonitor = () => {
    this.stop();
  };

  private async checkAnomalies(): Promise<void> {
    this.status.lastCheck = new Date();

    try {
      const events = await getUpcomingMeetings(this.calendarService);
      for (const event of events) {
        if (event.id && this.notifiedEvents.has(event.id)) continue;
        if (event.timeToStart <= 0 || event.timeToStart >= this.config.alertThresholdMs) continue;

        const clientName = extractClientName(event.title);
        if (!clientName) continue;

        const projectDir = await findProjectDirectory(this.config.projectsDir, clientName);
        if (!projectDir || await hasPresentationFile(projectDir)) continue;

        this.status.anomaliesDetected++;
        this.emit('anomaly-detected', { event, clientName, projectDir });
        await sendPresentationAlert(this.whatsappClient, (payload) => this.emit('notify-whatsapp', payload), event, clientName);
        this.rememberEvent(event.id, event.timeToStart);
      }
    } catch (error: any) {
      console.error('[BusinessAnomalyMonitor] Error en checkAnomalies:', error.message);
    }
  }

  private rememberEvent(eventId: string | undefined, timeToStart: number): void {
    if (!eventId) return;
    this.notifiedEvents.add(eventId);
    setTimeout(() => this.notifiedEvents.delete(eventId), timeToStart + 3600000);
  }
}
