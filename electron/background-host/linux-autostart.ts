import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';

import { getStartupScriptPathFromConfig } from './paths';
import type { BackgroundHostConfig } from './types';

export function isLinuxAutostartSupported(): boolean {
  return process.platform === 'linux';
}

export async function isLinuxAutostartInstalled(config: BackgroundHostConfig): Promise<boolean> {
  const filePath = getStartupScriptPathFromConfig(config);
  return Boolean(filePath && fsSync.existsSync(filePath));
}

export async function installLinuxAutostart(config: BackgroundHostConfig): Promise<void> {
  const filePath = getStartupScriptPathFromConfig(config);
  if (!filePath) throw new Error('No pude resolver ~/.config/autostart para Linux.');

  const desktopEntry = [
    '[Desktop Entry]',
    'Type=Application',
    'Name=Pulse Hub Background',
    `Exec=${quoteExec(process.execPath, config.launchArgs)}`,
    'Terminal=false',
    'X-GNOME-Autostart-enabled=true',
    'Categories=Office;Productivity;',
  ].join('\n');

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${desktopEntry}\n`, 'utf8');
}

export async function removeLinuxAutostart(config: BackgroundHostConfig): Promise<void> {
  const filePath = getStartupScriptPathFromConfig(config);
  if (filePath && fsSync.existsSync(filePath)) await fs.unlink(filePath).catch(() => {});
}

function quoteExec(executablePath: string, args: string[]): string {
  return [executablePath, ...args]
    .map((value) => `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`)
    .join(' ');
}

