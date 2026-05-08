import type { MonitoringStatus } from '../../../core/entities/ActivityLog';

const DEFAULT_CONFIG = {
  intervalSeconds: 30,
  idleThresholdSeconds: 120,
  screenshotEnabled: true,
  ocrEnabled: false,
};

export function createRunningStatus(userId: string, sessionId: string): MonitoringStatus {
  return { isRunning: true, userId, sessionId, snapshotCount: 0, config: DEFAULT_CONFIG };
}

export function createStoppedStatus(): MonitoringStatus {
  return { isRunning: false, snapshotCount: 0, sessionId: null, userId: null, config: DEFAULT_CONFIG };
}
