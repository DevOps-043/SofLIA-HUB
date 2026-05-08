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

  init(): void {
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.allowDowngrade = false;
    registerUpdaterEvents(autoUpdater, this.runtime.createEventHandlers());
    setTimeout(() => this.checkForUpdates().catch(() => {}), STARTUP_DELAY_MS);
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

  installUpdate(): void {
    autoUpdater.quitAndInstall(true, true);
  }

  getStatus(): UpdaterStatus {
    return this.runtime.getStatus();
  }

  stop(): void {
    if (!this.pollInterval) return;
    clearInterval(this.pollInterval);
    this.pollInterval = null;
  }
}
