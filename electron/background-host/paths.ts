import path from 'node:path';
import type { App } from 'electron';

import type { BackgroundHostConfig } from './types';

export function getConfigPath(app: App): string {
  return path.join(app.getPath('userData'), 'background-host.json');
}

export function getStartupScriptPathFromConfig(config: BackgroundHostConfig): string | null {
  if (process.platform !== 'win32') return null;

  const appData = process.env.APPDATA?.trim();
  if (!appData) return null;

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
