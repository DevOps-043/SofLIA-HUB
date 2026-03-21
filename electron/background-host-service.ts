import { app } from 'electron';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { execFile as execFileCb } from 'node:child_process';

const execFileAsync = promisify(execFileCb);

export const BACKGROUND_HOST_ARG = '--background';

type BackgroundHostInstallMode =
  | 'disabled'
  | 'unsupported'
  | 'scheduled-task'
  | 'startup-folder'
  | 'login-item-only';

export type BackgroundHostConfig = {
  enabled: boolean;
  taskName: string;
  startupScriptName: string;
  launchArgs: string[];
  installMode: BackgroundHostInstallMode;
  lastAppliedAt?: string;
  lastError?: string;
};

export type BackgroundHostStatus = {
  supported: boolean;
  packaged: boolean;
  enabled: boolean;
  installMode: BackgroundHostInstallMode;
  loginItemEnabled: boolean;
  scheduledTaskInstalled: boolean;
  startupScriptInstalled: boolean;
  taskName: string;
  startupScriptPath: string | null;
  executablePath: string;
  launchArgs: string[];
  lastAppliedAt?: string;
  lastError?: string;
};

function createDefaultConfig(): BackgroundHostConfig {
  const shouldAutoEnable = process.platform === 'win32' && app.isPackaged;
  return {
    enabled: shouldAutoEnable,
    taskName: 'SofLIA Hub Background',
    startupScriptName: 'SofLIA Hub Background.cmd',
    launchArgs: [BACKGROUND_HOST_ARG],
    installMode: shouldAutoEnable ? 'login-item-only' : 'disabled',
  };
}

function quoteForCmd(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export class BackgroundHostService {
  private config: BackgroundHostConfig = createDefaultConfig();
  private configLoaded = false;

  private getConfigPath(): string {
    return path.join(app.getPath('userData'), 'background-host.json');
  }

  private getStartupScriptPathFromConfig(config = this.config): string | null {
    if (process.platform !== 'win32') {
      return null;
    }

    const appData = process.env.APPDATA?.trim();
    if (!appData) {
      return null;
    }

    return path.join(
      appData,
      'Microsoft',
      'Windows',
      'Start Menu',
      'Programs',
      'Startup',
      config.startupScriptName,
    );
  }

  private async loadConfig(): Promise<void> {
    if (this.configLoaded) {
      return;
    }

    const configPath = this.getConfigPath();
    try {
      if (fsSync.existsSync(configPath)) {
        const raw = await fs.readFile(configPath, 'utf8');
        const parsed = JSON.parse(raw) as Partial<BackgroundHostConfig>;
        this.config = {
          ...createDefaultConfig(),
          ...parsed,
          launchArgs: Array.isArray(parsed.launchArgs) && parsed.launchArgs.length > 0
            ? parsed.launchArgs.map(value => String(value))
            : [BACKGROUND_HOST_ARG],
        };
      } else {
        this.config = createDefaultConfig();
        await this.saveConfig();
      }
    } catch (error: any) {
      this.config = {
        ...createDefaultConfig(),
        lastError: `No se pudo leer la configuracion del background host: ${error?.message || String(error)}`,
      };
      await this.saveConfig();
    }

    this.configLoaded = true;
  }

  private async saveConfig(): Promise<void> {
    const configPath = this.getConfigPath();
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    await fs.writeFile(configPath, JSON.stringify(this.config, null, 2), 'utf8');
  }

  private isSupported(): boolean {
    return process.platform === 'win32';
  }

  private buildLaunchSettings() {
    return {
      path: process.execPath,
      args: this.config.launchArgs,
    };
  }

  private setLoginItemEnabled(enabled: boolean): void {
    const launch = this.buildLaunchSettings();
    app.setLoginItemSettings({
      openAtLogin: enabled,
      openAsHidden: true,
      path: launch.path,
      args: launch.args,
    });
  }

  private getLoginItemEnabled(): boolean {
    const launch = this.buildLaunchSettings();
    const settings = app.getLoginItemSettings({
      path: launch.path,
      args: launch.args,
    });
    return Boolean(settings.openAtLogin);
  }

  private async isScheduledTaskInstalled(): Promise<boolean> {
    if (!this.isSupported() || !app.isPackaged) {
      return false;
    }

    try {
      await execFileAsync('schtasks.exe', ['/Query', '/TN', this.config.taskName], {
        timeout: 7000,
        windowsHide: true,
        maxBuffer: 1024 * 128,
      });
      return true;
    } catch {
      return false;
    }
  }

  private async removeScheduledTask(): Promise<void> {
    if (!this.isSupported() || !app.isPackaged) {
      return;
    }

    if (!await this.isScheduledTaskInstalled()) {
      return;
    }

    await execFileAsync('schtasks.exe', ['/Delete', '/F', '/TN', this.config.taskName], {
      timeout: 10000,
      windowsHide: true,
      maxBuffer: 1024 * 128,
    });
  }

  private async installScheduledTask(): Promise<void> {
    const launch = this.buildLaunchSettings();
    const taskCommand = `"${launch.path}" ${launch.args.join(' ')}`.trim();

    await execFileAsync('schtasks.exe', [
      '/Create',
      '/F',
      '/SC', 'ONLOGON',
      '/RL', 'LIMITED',
      '/TN', this.config.taskName,
      '/TR', taskCommand,
    ], {
      timeout: 12000,
      windowsHide: true,
      maxBuffer: 1024 * 256,
    });
  }

  private async installStartupScript(): Promise<void> {
    const startupScriptPath = this.getStartupScriptPathFromConfig();
    if (!startupScriptPath) {
      throw new Error('No pude resolver la carpeta Startup de Windows.');
    }

    await fs.mkdir(path.dirname(startupScriptPath), { recursive: true });
    const launch = this.buildLaunchSettings();
    const script = [
      '@echo off',
      `start "" ${quoteForCmd(launch.path)} ${launch.args.join(' ')}`.trim(),
    ].join('\r\n');
    await fs.writeFile(startupScriptPath, script, 'utf8');
  }

  private async removeStartupScript(): Promise<void> {
    const startupScriptPath = this.getStartupScriptPathFromConfig();
    if (!startupScriptPath || !fsSync.existsSync(startupScriptPath)) {
      return;
    }
    await fs.unlink(startupScriptPath).catch(() => {});
  }

  async init(): Promise<void> {
    await this.loadConfig();
    if (this.config.enabled) {
      await this.ensureConfigured();
    }
  }

  async ensureConfigured(): Promise<BackgroundHostStatus> {
    await this.loadConfig();

    if (!this.isSupported()) {
      this.config.installMode = 'unsupported';
      await this.saveConfig();
      return this.getStatus();
    }

    this.setLoginItemEnabled(this.config.enabled);

    if (!this.config.enabled) {
      await this.removeScheduledTask().catch(() => {});
      await this.removeStartupScript().catch(() => {});
      this.config.installMode = 'disabled';
      this.config.lastAppliedAt = new Date().toISOString();
      this.config.lastError = undefined;
      await this.saveConfig();
      return this.getStatus();
    }

    if (!app.isPackaged) {
      this.config.installMode = 'login-item-only';
      this.config.lastAppliedAt = new Date().toISOString();
      this.config.lastError = 'Modo desarrollo: se habilita solo openAtLogin; schtasks requiere app empaquetada.';
      await this.saveConfig();
      return this.getStatus();
    }

    try {
      await this.installScheduledTask();
      await this.removeStartupScript().catch(() => {});
      this.config.installMode = 'scheduled-task';
      this.config.lastError = undefined;
    } catch (error: any) {
      try {
        await this.installStartupScript();
        this.config.installMode = 'startup-folder';
        this.config.lastError = `schtasks fallo y se aplico fallback Startup: ${error?.message || String(error)}`;
      } catch (fallbackError: any) {
        this.config.installMode = 'login-item-only';
        this.config.lastError = `No se pudo instalar schtasks ni Startup fallback: ${fallbackError?.message || String(fallbackError)}`;
      }
    }

    this.config.lastAppliedAt = new Date().toISOString();
    await this.saveConfig();
    return this.getStatus();
  }

  async updateConfig(partial: Partial<Pick<BackgroundHostConfig, 'enabled'>>): Promise<BackgroundHostStatus> {
    await this.loadConfig();
    if (typeof partial.enabled === 'boolean') {
      this.config.enabled = partial.enabled;
    }
    await this.saveConfig();
    return this.ensureConfigured();
  }

  async repair(): Promise<BackgroundHostStatus> {
    await this.loadConfig();
    return this.ensureConfigured();
  }

  async getStatus(): Promise<BackgroundHostStatus> {
    await this.loadConfig();

    const startupScriptPath = this.getStartupScriptPathFromConfig();

    return {
      supported: this.isSupported(),
      packaged: app.isPackaged,
      enabled: this.config.enabled,
      installMode: this.config.installMode,
      loginItemEnabled: this.getLoginItemEnabled(),
      scheduledTaskInstalled: await this.isScheduledTaskInstalled(),
      startupScriptInstalled: Boolean(startupScriptPath && fsSync.existsSync(startupScriptPath)),
      taskName: this.config.taskName,
      startupScriptPath,
      executablePath: process.execPath,
      launchArgs: [...this.config.launchArgs],
      lastAppliedAt: this.config.lastAppliedAt,
      lastError: this.config.lastError,
    };
  }
}

export const backgroundHostService = new BackgroundHostService();
