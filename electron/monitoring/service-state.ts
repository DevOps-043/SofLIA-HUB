import type { ActivitySnapshot, MonitoringConfig, MonitoringDiagnostics } from './types';

export interface MonitoringRuntimeState {
  intervalId: NodeJS.Timeout | null;
  isRunning: boolean;
  config: MonitoringConfig;
  sessionId: string | null;
  userId: string | null;
  snapshotBuffer: ActivitySnapshot[];
  allSnapshots: ActivitySnapshot[];
  snapshotCount: number;
  screenshotDir: string;
  lastWindowTitle: string;
  diagnostics: MonitoringDiagnostics;
}

export function createMonitoringRuntimeState(screenshotDir: string, sharpAvailable: boolean): MonitoringRuntimeState {
  return {
    intervalId: null,
    isRunning: false,
    config: {
      intervalSeconds: 30,
      idleThresholdSeconds: 120,
      screenshotEnabled: true,
      ocrEnabled: false,
      semanticSnapshotEnabled: false,
    },
    sessionId: null,
    userId: null,
    snapshotBuffer: [],
    allSnapshots: [],
    snapshotCount: 0,
    screenshotDir,
    lastWindowTitle: '',
    diagnostics: {
      sharpAvailable,
      activeWinAvailable: false,
      screenshotFailCount: 0,
      activeWinFailCount: 0,
    },
  };
}

export function flushMonitoringBuffer(state: MonitoringRuntimeState): ActivitySnapshot[] {
  const batch = [...state.snapshotBuffer];
  state.snapshotBuffer = [];
  return batch;
}
