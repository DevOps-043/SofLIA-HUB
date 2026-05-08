import { app } from 'electron';

import type { BackgroundHostConfig } from './types';
import { BACKGROUND_HOST_ARG } from './types';

export function createDefaultBackgroundHostConfig(): BackgroundHostConfig {
  const shouldAutoEnable = process.platform === 'win32' && app.isPackaged;
  return {
    enabled: shouldAutoEnable,
    taskName: 'SofLIA Hub Background',
    startupScriptName: 'SofLIA Hub Background.cmd',
    launchArgs: [BACKGROUND_HOST_ARG],
    installMode: shouldAutoEnable ? 'login-item-only' : 'disabled',
  };
}
