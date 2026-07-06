import { app } from 'electron';

import { loadBackgroundHostConfig, saveBackgroundHostConfig } from './background-host/config-store';
import { createDefaultBackgroundHostConfig } from './background-host/defaults';
import { buildBackgroundHostStatus } from './background-host/status';
import type { BackgroundHostConfig, BackgroundHostStatus } from './background-host/types';
import {
  installScheduledTask,
  installStartupScript,
  isSupported,
  removeScheduledTask,
  removeStartupScript,
  setLoginItemEnabled,
} from './background-host/platform-installers';

export { BACKGROUND_HOST_ARG } from './background-host/types';
export type { BackgroundHostConfig, BackgroundHostStatus } from './background-host/types';

export class BackgroundHostService {
  private config: BackgroundHostConfig = createDefaultBackgroundHostConfig();
  private configLoaded = false;

  private async loadConfig(): Promise<void> {
    if (this.configLoaded) return;
    this.config = await loadBackgroundHostConfig(app);
    this.configLoaded = true;
  }

  private async saveConfig(): Promise<void> {
    await saveBackgroundHostConfig(app, this.config);
  }

  async init(): Promise<void> {
    await this.loadConfig();
    if (this.config.enabled) await this.ensureConfigured();
  }

  async ensureConfigured(): Promise<BackgroundHostStatus> {
    await this.loadConfig();

    if (!isSupported()) {
      this.config.installMode = 'unsupported';
      await this.saveConfig();
      return this.getStatus();
    }

    setLoginItemEnabled(app, this.config);

    if (!this.config.enabled) {
      await removeScheduledTask(this.config).catch(() => {});
      await removeStartupScript(this.config).catch(() => {});
      this.config.installMode = 'disabled';
      this.config.lastError = undefined;
      this.config.lastAppliedAt = new Date().toISOString();
      await this.saveConfig();
      return this.getStatus();
    }

    await this.applyPackagedBackgroundInstall();
    return this.getStatus();
  }

  private async applyPackagedBackgroundInstall(): Promise<void> {
    if (!app.isPackaged) {
      this.config.installMode = 'login-item-only';
      this.config.lastError = process.platform === 'linux'
        ? 'Modo desarrollo: XDG Autostart se aplica solo en app empaquetada.'
        : 'Modo desarrollo: se habilita solo openAtLogin; schtasks requiere app empaquetada.';
    } else {
      if (process.platform === 'linux') await this.tryInstallLinuxBackgroundHost();
      else await this.tryInstallWindowsBackgroundHost();
    }
    this.config.lastAppliedAt = new Date().toISOString();
    await this.saveConfig();
  }

  private async tryInstallWindowsBackgroundHost(): Promise<void> {
    try {
      await installScheduledTask(this.config);
      await removeStartupScript(this.config).catch(() => {});
      this.config.installMode = 'scheduled-task';
      this.config.lastError = undefined;
    } catch (error: any) {
      try {
        await installStartupScript(this.config);
        this.config.installMode = 'startup-folder';
        this.config.lastError = `schtasks fallo y se aplico fallback Startup: ${error?.message || String(error)}`;
      } catch (fallbackError: any) {
        this.config.installMode = 'login-item-only';
        this.config.lastError = `No se pudo instalar schtasks ni Startup fallback: ${fallbackError?.message || String(fallbackError)}`;
      }
    }
  }

  private async tryInstallLinuxBackgroundHost(): Promise<void> {
    try {
      await removeScheduledTask(this.config).catch(() => {});
      await installStartupScript(this.config);
      this.config.installMode = 'xdg-autostart';
      this.config.lastError = undefined;
    } catch (error: any) {
      this.config.installMode = 'disabled';
      this.config.lastError = `No se pudo instalar XDG Autostart: ${error?.message || String(error)}`;
    }
  }

  async updateConfig(partial: Partial<Pick<BackgroundHostConfig, 'enabled'>>): Promise<BackgroundHostStatus> {
    await this.loadConfig();
    if (typeof partial.enabled === 'boolean') this.config.enabled = partial.enabled;
    await this.saveConfig();
    return this.ensureConfigured();
  }

  async repair(): Promise<BackgroundHostStatus> {
    await this.loadConfig();
    return this.ensureConfigured();
  }

  async getStatus(): Promise<BackgroundHostStatus> {
    await this.loadConfig();
    return buildBackgroundHostStatus(app, this.config);
  }
}

export const backgroundHostService = new BackgroundHostService();
