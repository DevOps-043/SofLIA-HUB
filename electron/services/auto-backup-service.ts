import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';

import { createNativeBackup } from './auto-backup/native-backup';
import type { AutoBackupConfig, BackupStatus } from './auto-backup/types';

export type { AutoBackupConfig, BackupStatus } from './auto-backup/types';

export class AutoBackupService extends EventEmitter {
  private config: AutoBackupConfig;
  private intervalId?: NodeJS.Timeout;
  private status: BackupStatus = { isBackingUp: false };

  constructor(config: AutoBackupConfig) {
    super();
    this.config = { ...config, intervalDays: config.intervalDays || 7, prefix: config.prefix || 'soflia_backup' };
  }

  async init(): Promise<void> {
    try {
      if (!fs.existsSync(this.config.outputDir)) fs.mkdirSync(this.config.outputDir, { recursive: true });
      this.emit('initialized', { config: this.config });
    } catch (error: any) {
      this.emit('error', new Error(`Error al inicializar AutoBackupService: ${error.message}`));
    }
  }

  async start(): Promise<void> {
    if (this.intervalId) await this.stop();
    const msInterval = (this.config.intervalDays || 7) * 24 * 60 * 60 * 1000;
    this.updateNextBackupDate(msInterval);
    this.intervalId = setInterval(() => this.runScheduledBackup(), msInterval);
    this.emit('started', { intervalDays: this.config.intervalDays, nextBackupDate: this.status.nextBackupDate });
  }

  async stop(): Promise<void> {
    if (!this.intervalId) return;
    clearInterval(this.intervalId);
    this.intervalId = undefined;
    this.status.nextBackupDate = undefined;
    this.emit('stopped');
  }

  getStatus(): BackupStatus {
    return this.status;
  }

  getConfig(): AutoBackupConfig {
    return this.config;
  }

  addSourceDirectory(dirPath: string): boolean {
    if (!fs.existsSync(dirPath) || this.config.sourceDirs.includes(dirPath)) return false;
    this.config.sourceDirs.push(dirPath);
    this.emit('config-updated', this.config);
    return true;
  }

  removeSourceDirectory(dirPath: string): boolean {
    const initialLength = this.config.sourceDirs.length;
    this.config.sourceDirs = this.config.sourceDirs.filter((directory) => directory !== dirPath);
    if (this.config.sourceDirs.length === initialLength) return false;
    this.emit('config-updated', this.config);
    return true;
  }

  updateInterval(days: number): void {
    if (days <= 0) throw new Error('El intervalo debe ser mayor a 0 dias');
    this.config.intervalDays = days;
    this.emit('config-updated', this.config);
    if (this.intervalId) this.start();
  }

  public async createBackup(sourceDirs: string[], outputPath: string): Promise<void> {
    if (this.status.isBackingUp) throw new Error('Un respaldo ya esta en progreso.');
    if (sourceDirs.length === 0) throw new Error('No hay directorios fuente especificados para el respaldo.');

    this.status.isBackingUp = true;
    this.status.error = undefined;
    this.emit('backup-started', { sourceDirs, outputPath });
    try {
      const result = await createNativeBackup(sourceDirs, outputPath, (message) => this.emit('warning', message));
      this.status.isBackingUp = false;
      this.status.lastBackupDate = new Date();
      this.status.lastBackupSize = result.sizeBytes;
      this.status.lastBackupPath = result.path;
      this.emit('backup-completed', result);
      this.emit('system-notification', { title: 'Respaldo Automatico', body: result.message, type: 'success' });
    } catch (err: any) {
      this.status.isBackingUp = false;
      this.status.error = err.message || 'Error desconocido al crear el respaldo';
      this.emit('error', new Error(`Fallo en el respaldo: ${err.message}`));
      throw err;
    }
  }

  private async runScheduledBackup(): Promise<void> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const extension = process.platform === 'win32' ? 'zip' : 'tar.gz';
      await this.createBackup(
        this.config.sourceDirs,
        path.join(this.config.outputDir, `${this.config.prefix}_${timestamp}.${extension}`),
      );
      this.updateNextBackupDate((this.config.intervalDays || 7) * 24 * 60 * 60 * 1000);
    } catch (err: any) {
      this.emit('error', new Error(`Fallo en el respaldo programado: ${err.message}`));
    }
  }

  private updateNextBackupDate(msInterval: number): void {
    this.status.nextBackupDate = new Date(Date.now() + msInterval);
  }
}
