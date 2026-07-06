import type { App } from 'electron';

import { getStartupScriptPathFromConfig } from './paths';
import type { BackgroundHostConfig, BackgroundHostStatus } from './types';
import { getLoginItemEnabled, isScheduledTaskInstalled, isStartupScriptInstalled, isSupported } from './platform-installers';

export async function buildBackgroundHostStatus(app: App, config: BackgroundHostConfig): Promise<BackgroundHostStatus> {
  const startupScriptPath = getStartupScriptPathFromConfig(config);
  return {
    supported: isSupported(),
    packaged: app.isPackaged,
    enabled: config.enabled,
    installMode: config.installMode,
    loginItemEnabled: getLoginItemEnabled(app, config),
    scheduledTaskInstalled: await isScheduledTaskInstalled(config),
    startupScriptInstalled: await isStartupScriptInstalled(config),
    taskName: config.taskName,
    startupScriptPath,
    executablePath: process.execPath,
    launchArgs: [...config.launchArgs],
    lastAppliedAt: config.lastAppliedAt,
    lastError: config.lastError,
  };
}
