import type { App } from 'electron';
import { execFile as execFileCb } from 'node:child_process';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';

import { getStartupScriptPathFromConfig } from './paths';
import type { BackgroundHostConfig } from './types';

const execFileAsync = promisify(execFileCb);

export function isSupported(): boolean {
  return process.platform === 'win32';
}

function buildLaunchSettings(config: BackgroundHostConfig) {
  return { path: process.execPath, args: config.launchArgs };
}

function quoteForCmd(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export function setLoginItemEnabled(app: App, config: BackgroundHostConfig): void {
  const launch = buildLaunchSettings(config);
  app.setLoginItemSettings({
    openAtLogin: config.enabled,
    openAsHidden: true,
    path: launch.path,
    args: launch.args,
  });
}

export function getLoginItemEnabled(app: App, config: BackgroundHostConfig): boolean {
  const launch = buildLaunchSettings(config);
  return Boolean(app.getLoginItemSettings({ path: launch.path, args: launch.args }).openAtLogin);
}

export async function isScheduledTaskInstalled(config: BackgroundHostConfig): Promise<boolean> {
  if (!isSupported()) return false;
  try {
    await execFileAsync('schtasks.exe', ['/Query', '/TN', config.taskName], { timeout: 7000, windowsHide: true, maxBuffer: 1024 * 128 });
    return true;
  } catch {
    return false;
  }
}

export async function removeScheduledTask(config: BackgroundHostConfig): Promise<void> {
  if (!await isScheduledTaskInstalled(config)) return;
  await execFileAsync('schtasks.exe', ['/Delete', '/F', '/TN', config.taskName], { timeout: 10000, windowsHide: true, maxBuffer: 1024 * 128 });
}

export async function installScheduledTask(config: BackgroundHostConfig): Promise<void> {
  const launch = buildLaunchSettings(config);
  await execFileAsync('schtasks.exe', [
    '/Create', '/F', '/SC', 'ONLOGON', '/RL', 'LIMITED',
    '/TN', config.taskName, '/TR', `"${launch.path}" ${launch.args.join(' ')}`.trim(),
  ], { timeout: 12000, windowsHide: true, maxBuffer: 1024 * 256 });
}

export async function installStartupScript(config: BackgroundHostConfig): Promise<void> {
  const startupScriptPath = getStartupScriptPathFromConfig(config);
  if (!startupScriptPath) throw new Error('No pude resolver la carpeta Startup de Windows.');
  const launch = buildLaunchSettings(config);
  const script = ['@echo off', `start "" ${quoteForCmd(launch.path)} ${launch.args.join(' ')}`.trim()].join('\r\n');
  await fs.mkdir(path.dirname(startupScriptPath), { recursive: true });
  await fs.writeFile(startupScriptPath, script, 'utf8');
}

export async function removeStartupScript(config: BackgroundHostConfig): Promise<void> {
  const startupScriptPath = getStartupScriptPathFromConfig(config);
  if (startupScriptPath && fsSync.existsSync(startupScriptPath)) await fs.unlink(startupScriptPath).catch(() => {});
}
