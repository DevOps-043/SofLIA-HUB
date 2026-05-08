export const BACKGROUND_HOST_ARG = '--background';

export type BackgroundHostInstallMode =
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
