import type { App } from 'electron';
import fsSync from 'node:fs';

import { getStartupScriptPathFromConfig } from './paths';
import type { BackgroundHostConfig, BackgroundHostStatus } from './types';
import { getLoginItemEnabled, isScheduledTaskInstalled, isSupported } from './windows-installers';

export async function buildBackgroundHostStatus(app: App, config: BackgroundHostConfig): Promise<BackgroundHostStatus> {
  const startupScriptPath = getStartupScriptPathFromConfig(config);
  return {
    supported: isSupported(),
    packaged: app.isPackaged,
    enabled: config.enabled,
    installMode: config.installMode,
    loginItemEnabled: getLoginItemEnabled(app, config),
    scheduledTaskInstalled: await isScheduledTaskInstalled(config),
    startupScriptInstalled: Boolean(startupScriptPath && fsSync.existsSync(startupScriptPath)),
    taskName: config.taskName,
    startupScriptPath,
    executablePath: process.execPath,
    launchArgs: [...config.launchArgs],
    lastAppliedAt: config.lastAppliedAt,
    lastError: config.lastError,
  };
}
