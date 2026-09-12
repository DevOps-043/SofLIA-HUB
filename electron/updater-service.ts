import { EventEmitter } from 'events';
import { app } from 'electron';
import electronUpdater from 'electron-updater';
import { CHECK_INTERVAL_MS, STARTUP_DELAY_MS } from './updater/constants';
import { registerUpdaterEvents } from './updater/events';
import { UpdaterRuntime } from './updater/runtime';
import type { UpdaterStatus } from './updater/types';

const { autoUpdater } = electronUpdater as typeof import('electron-updater');

export type { UpdaterState, UpdaterStatus } from './updater/types';

export class UpdaterService extends EventEmitter {
  private readonly runtime = new UpdaterRuntime(
    (event, payload) => this.emit(event, payload),
    () => app.getVersion(),
  );
  private pollInterval: NodeJS.Timeout | null = null;
  private startupTimer: NodeJS.Timeout | null = null;
  private installRequested = false;
  private installGuard: ((install: () => void) => Promise<boolean>) | null = null;
  private pendingInstall: Promise<void> | null = null;
  private onInstallFailure: (() => void) | null = null;

  setInstallGuard(guard: (install: () => void) => Promise<boolean>, onFailure?: () => void): void {
    this.installGuard = guard;
    this.onInstallFailure = onFailure ?? null;
  }

  init(): void {
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.allowDowngrade = false;
    const handlers = this.runtime.createEventHandlers();
    registerUpdaterEvents(autoUpdater, {
      ...handlers,
      error: (error) => {
        if (this.installRequested) { this.installRequested = false; this.onInstallFailure?.(); }
        handlers.error(error);
      },
    });
    this.startupTimer = setTimeout(() => { this.startupTimer = null; void this.checkForUpdates().catch(() => {}); }, STARTUP_DELAY_MS);
    this.pollInterval = setInterval(() => this.checkForUpdates().catch(() => {}), CHECK_INTERVAL_MS);
    console.log('[Updater] Inicializado - polling cada 4h');
  }

  async checkForUpdates(): Promise<UpdaterStatus> {
    try {
      await autoUpdater.checkForUpdates();
    } catch (err: any) {
      this.runtime.handleError(err);
    }
    return this.getStatus();
  }

  async downloadUpdate(): Promise<void> {
    this.runtime.startDownload();
    await autoUpdater.downloadUpdate();
  }

  installUpdate(): Promise<void> {
    if (this.pendingInstall) return this.pendingInstall;
    if (this.installRequested) return Promise.resolve();
    const pending = this.installAfterSaving();
    this.pendingInstall = pending;
    void pending.finally(() => { if (this.pendingInstall === pending) this.pendingInstall = null; }).catch(() => undefined);
    return pending;
  }

  private async installAfterSaving(): Promise<void> {
    if (this.getStatus().state !== 'downloaded') throw new Error('No hay una actualización descargada lista para instalar.');
    if (!this.installGuard) throw new Error('La protección de cierre todavía no está disponible.');
    const accepted = await this.installGuard(() => {
      this.installRequested = true;
      try {
        autoUpdater.quitAndInstall(true, true);
        if (this.getStatus().state === 'error') throw new Error('El instalador informó un error.');
      }
      catch (error) { this.installRequested = false; throw error; }
    });
    if (!accepted) throw new Error('La instalación se canceló o hay otra salida en curso.');
  }

  getStatus(): UpdaterStatus {
    return this.runtime.getStatus();
  }

  stop(): void {
    if (this.startupTimer) { clearTimeout(this.startupTimer); this.startupTimer = null; }
    if (!this.pollInterval) return;
    clearInterval(this.pollInterval);
    this.pollInterval = null;
  }
}
