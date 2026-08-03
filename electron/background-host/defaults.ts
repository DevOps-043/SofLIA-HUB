import { app } from 'electron';

import type { BackgroundHostConfig } from './types';
import { BACKGROUND_HOST_ARG } from './types';

export function createDefaultBackgroundHostConfig(): BackgroundHostConfig {
  const shouldAutoEnable = (process.platform === 'win32' || process.platform === 'linux') && app.isPackaged;
  return {
    enabled: shouldAutoEnable,
    taskName: 'Pulse Hub Background',
    startupScriptName: process.platform === 'linux' ? 'Pulse Hub Background.desktop' : 'Pulse Hub Background.cmd',
    launchArgs: [BACKGROUND_HOST_ARG],
    installMode: shouldAutoEnable ? (process.platform === 'linux' ? 'xdg-autostart' : 'login-item-only') : 'disabled',
  };
}
