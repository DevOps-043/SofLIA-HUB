import { app } from 'electron';
import path from 'node:path';
import type { ActivitySnapshot, MonitoringConfig, MonitoringDiagnostics, MonitoringStatus } from './types';

export interface MonitoringRuntimeState {
  allSnapshots: ActivitySnapshot[];
  config: MonitoringConfig;
  diagnostics: MonitoringDiagnostics;
  intervalId: NodeJS.Timeout | null;
  isRunning: boolean;
  lastWindowTitle: string;
  screenshotDir: string;
  sessionId: string | null;
  snapshotBuffer: ActivitySnapshot[];
  snapshotCount: number;
  userId: string | null;
}

export function createMonitoringState(sharpAvailable: boolean): MonitoringRuntimeState {
  return {
    allSnapshots: [],
    config: {
      intervalSeconds: 30,
      idleThresholdSeconds: 120,
      screenshotEnabled: true,
      ocrEnabled: false,
      semanticSnapshotEnabled: false,
    },
    diagnostics: {
      sharpAvailable,
      activeWinAvailable: false,
      screenshotFailCount: 0,
      activeWinFailCount: 0,
    },
    intervalId: null,
    isRunning: false,
    lastWindowTitle: '',
    screenshotDir: path.join(app.getPath('temp'), 'soflia-monitoring'),
    sessionId: null,
    snapshotBuffer: [],
    snapshotCount: 0,
    userId: null,
  };
}

export function resetMonitoringSession(state: MonitoringRuntimeState, userId: string, sessionId: string): void {
  state.userId = userId;
  state.sessionId = sessionId;
  state.isRunning = true;
  state.snapshotCount = 0;
  state.snapshotBuffer = [];
  state.allSnapshots = [];
  state.lastWindowTitle = '';
}

export function clearMonitoringSession(state: MonitoringRuntimeState): void {
  state.sessionId = null;
  state.userId = null;
  state.snapshotCount = 0;
  state.allSnapshots = [];
}

export function buildMonitoringStatus(state: MonitoringRuntimeState): MonitoringStatus {
  return {
    isRunning: state.isRunning,
    sessionId: state.sessionId,
    userId: state.userId,
    snapshotCount: state.snapshotCount,
    currentWindow: state.lastWindowTitle || undefined,
    config: { ...state.config },
    diagnostics: { ...state.diagnostics },
  };
}

export function flushMonitoringBuffer(state: MonitoringRuntimeState): ActivitySnapshot[] {
  const batch = [...state.snapshotBuffer];
  state.snapshotBuffer = [];
  return batch;
}

export function recordMonitoringSnapshot(
  state: MonitoringRuntimeState,
  snapshot: ActivitySnapshot,
  windowTitle: string,
): ActivitySnapshot[] | null {
  state.lastWindowTitle = windowTitle;
  state.snapshotCount++;
  state.snapshotBuffer.push(snapshot);
  state.allSnapshots.push(snapshot);
  return state.snapshotBuffer.length >= 2 ? flushMonitoringBuffer(state) : null;
}
