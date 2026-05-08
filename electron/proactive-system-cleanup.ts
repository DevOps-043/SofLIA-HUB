import { EventEmitter } from 'node:events';
import {
  bytesToGB,
  deleteCleanupFiles,
} from './proactive-system-cleanup/cleanup-runner';
import { scanCleanupCandidates } from './proactive-system-cleanup/scanner';
import type {
  CleanupConfig,
  CleanupStatus,
} from './proactive-system-cleanup/types';

export type {
  CleanupConfig,
  CleanupStatus,
} from './proactive-system-cleanup/types';

export class SystemCleanupService extends EventEmitter {
  private config: CleanupConfig;
  private intervalId?: NodeJS.Timeout;
  private isMonitoring = false;
  private lastCheck?: Date;
  private filesToClean: string[] = [];
  private totalBytesFound = 0;

  constructor(config: CleanupConfig = {}) {
    super();
    this.config = {
      checkIntervalMs: config.checkIntervalMs || 24 * 60 * 60 * 1000,
      sizeThresholdBytes: config.sizeThresholdBytes || 5 * 1024 * 1024 * 1024,
      ageThresholdDays: config.ageThresholdDays || 30,
    };
  }

  async init(): Promise<void> {
    console.log('[SystemCleanupService] Inicializando servicio de limpieza proactiva...');
  }

  async start(): Promise<void> {
    if (this.isMonitoring) return;
    this.isMonitoring = true;
    this.startMonitoring();
    console.log('[SystemCleanupService] Monitoreo iniciado');
  }

  async stop(): Promise<void> {
    if (this.intervalId) clearInterval(this.intervalId);
    this.intervalId = undefined;
    this.isMonitoring = false;
    console.log('[SystemCleanupService] Monitoreo detenido');
  }

  getStatus(): CleanupStatus {
    return {
      isMonitoring: this.isMonitoring,
      lastCheck: this.lastCheck,
      bytesFound: this.totalBytesFound,
      filesToClean: this.filesToClean,
    };
  }

  getConfig(): CleanupConfig {
    return this.config;
  }

  async executeCleanup(): Promise<{ success: boolean; bytesFreed: number; message: string }> {
    if (this.filesToClean.length === 0) {
      return { success: false, bytesFreed: 0, message: 'No hay archivos antiguos pendientes por limpiar.' };
    }

    const { freed, deletedCount } = await deleteCleanupFiles(this.filesToClean);
    const message = `Limpieza inteligente completada. Se eliminaron ${deletedCount} archivos y se recuperaron ${bytesToGB(freed)} GB de espacio.`;
    this.filesToClean = [];
    this.totalBytesFound = 0;
    this.emit('cleanup-completed', { success: true, bytesFreed: freed, deletedCount, message });
    return { success: true, bytesFreed: freed, message };
  }

  private startMonitoring(): void {
    void this.checkDirectories();
    this.intervalId = setInterval(() => void this.checkDirectories(), this.config.checkIntervalMs);
  }

  private async checkDirectories(): Promise<void> {
    this.lastCheck = new Date();
    const scan = await scanCleanupCandidates(this.config);
    const threshold = this.config.sizeThresholdBytes || 5368709120;
    this.filesToClean = scan.totalSize > threshold ? scan.filesToClean : [];
    this.totalBytesFound = scan.totalSize > threshold ? scan.totalBytesFound : 0;
    if (this.filesToClean.length === 0 || this.totalBytesFound <= 1024 * 1024) return;

    this.emit('proactive-alert', {
      type: 'system_cleanup_required',
      message: `Tienes ${bytesToGB(scan.totalSize)} GB ocupados en Descargas y Temporales. Puedo liberar ${bytesToGB(this.totalBytesFound)} GB eliminando archivos antiguos.`,
      data: { totalBytes: scan.totalSize, liberableBytes: this.totalBytesFound, fileCount: this.filesToClean.length },
    });
  }
}
