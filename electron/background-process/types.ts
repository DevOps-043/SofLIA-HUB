export type ManagedSessionKind = 'command' | 'claude' | 'application';
export type ManagedSessionStatus = 'running' | 'completed' | 'failed' | 'killed' | 'unknown';
export type ManagedSessionMode = 'background' | 'visible-terminal' | 'application';

export type SessionExitState = {
  exitCode?: number | null;
  finishedAt?: string;
};

export type ManagedSessionRecord = {
  id: string;
  kind: ManagedSessionKind;
  mode: ManagedSessionMode;
  title: string;
  status: ManagedSessionStatus;
  command?: string;
  targetPath?: string;
  workingDirectory?: string;
  pid?: number;
  visible: boolean;
  keepOpen: boolean;
  startedAt: string;
  endedAt?: string;
  exitCode?: number | null;
  lastError?: string;
  outputAvailable: boolean;
  stdoutLogPath?: string;
  stderrLogPath?: string;
  exitStatePath?: string;
  metadataPath?: string;
  sessionDir?: string;
  metadata?: Record<string, any>;
};

export type ManagedSessionView = Omit<
  ManagedSessionRecord,
  'stdoutLogPath' | 'stderrLogPath' | 'exitStatePath' | 'metadataPath' | 'sessionDir'
> & {
  stdoutTail?: string;
  stderrTail?: string;
};

export type StartBackgroundCommandOptions = {
  command: string;
  workingDirectory?: string;
  title?: string;
  kind?: ManagedSessionKind;
  metadata?: Record<string, any>;
};

export type StartVisibleTerminalOptions = StartBackgroundCommandOptions & {
  keepOpen?: boolean;
};

export type LaunchApplicationOptions = {
  targetPath: string;
  title?: string;
  metadata?: Record<string, any>;
};
