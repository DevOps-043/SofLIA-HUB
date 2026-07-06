import type { App } from 'electron';
import fsSync from 'node:fs';

import {
  getLoginItemEnabled as getWindowsLoginItemEnabled,
  installScheduledTask,
  installStartupScript as installWindowsStartupScript,
  isScheduledTaskInstalled,
  isSupported as isWindowsSupported,
  removeScheduledTask,
  removeStartupScript as removeWindowsStartupScript,
  setLoginItemEnabled as setWindowsLoginItemEnabled,
} from './windows-installers';
import {
  installLinuxAutostart,
  isLinuxAutostartInstalled,
  isLinuxAutostartSupported,
  removeLinuxAutostart,
} from './linux-autostart';
import { getStartupScriptPathFromConfig } from './paths';
import type { BackgroundHostConfig } from './types';

export { installScheduledTask, isScheduledTaskInstalled, removeScheduledTask };

export function isSupported(): boolean {
  return isWindowsSupported() || isLinuxAutostartSupported();
}

export function setLoginItemEnabled(app: App, config: BackgroundHostConfig): void {
  if (process.platform === 'win32') setWindowsLoginItemEnabled(app, config);
}

export function getLoginItemEnabled(app: App, config: BackgroundHostConfig): boolean {
  if (process.platform === 'win32') return getWindowsLoginItemEnabled(app, config);
  return false;
}

export async function installStartupScript(config: BackgroundHostConfig): Promise<void> {
  if (process.platform === 'linux') return installLinuxAutostart(config);
  return installWindowsStartupScript(config);
}

export async function removeStartupScript(config: BackgroundHostConfig): Promise<void> {
  if (process.platform === 'linux') return removeLinuxAutostart(config);
  return removeWindowsStartupScript(config);
}

export async function isStartupScriptInstalled(config: BackgroundHostConfig): Promise<boolean> {
  if (process.platform === 'linux') return isLinuxAutostartInstalled(config);
  const startupPath = getStartupScriptPathFromConfig(config);
  if (!startupPath) return false;
  return fsSync.existsSync(startupPath);
}
