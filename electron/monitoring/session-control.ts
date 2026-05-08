import fs from 'node:fs/promises';
import type { EventEmitter } from 'node:events';
import type { ActivitySnapshot, MonitoringConfig, MonitoringStatus } from './types';
import { flushMonitoringBuffer, type MonitoringRuntimeState } from './service-state';

type CaptureSnapshot = () => Promise<void>;

export async function startMonitoringSession(
  state: MonitoringRuntimeState,
  emitter: EventEmitter,
  userId: string,
  sessionId: string,
  captureSnapshot: CaptureSnapshot,
): Promise<void> {
  if (state.isRunning) await stopMonitoringSession(state, emitter);

  Object.assign(state, {
    userId,
    sessionId,
    isRunning: true,
    snapshotCount: 0,
    snapshotBuffer: [],
    allSnapshots: [],
    lastWindowTitle: '',
  });

  await fs.mkdir(state.screenshotDir, { recursive: true });
  console.log(`[MonitoringService] Started for user ${userId}, session ${sessionId}, interval ${state.config.intervalSeconds}s`);
  emitter.emit('session-started', { userId, sessionId });
  state.intervalId = createCaptureInterval(state, emitter, captureSnapshot);
  captureSnapshot().catch(() => {});
}

export async function stopMonitoringSession(
  state: MonitoringRuntimeState,
  emitter: EventEmitter,
): Promise<{ snapshotCount: number; buffer: ActivitySnapshot[] }> {
  if (!state.isRunning) return { snapshotCount: 0, buffer: [] };
  if (state.intervalId) clearInterval(state.intervalId);

  state.intervalId = null;
  state.isRunning = false;
  const count = state.snapshotCount;
  const buffer = flushMonitoringBuffer(state);
  console.log(`[MonitoringService] Stopped. Total snapshots: ${count}`);
  emitter.emit('session-ended', {
    userId: state.userId,
    sessionId: state.sessionId,
    snapshotCount: count,
    pendingSnapshots: buffer,
    allSnapshots: [...state.allSnapshots],
  });

  state.sessionId = null;
  state.userId = null;
  state.snapshotCount = 0;
  state.allSnapshots = [];
  return { snapshotCount: count, buffer };
}

export function getMonitoringStatus(state: MonitoringRuntimeState): MonitoringStatus {
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

export function updateMonitoringConfig(
  state: MonitoringRuntimeState,
  config: Partial<MonitoringConfig>,
  captureSnapshot: CaptureSnapshot,
): void {
  Object.assign(state.config, config);
  console.log('[MonitoringService] Config updated:', state.config);
  if (state.isRunning && config.intervalSeconds && state.intervalId) {
    clearInterval(state.intervalId);
    state.intervalId = createCaptureInterval(state, null, captureSnapshot);
  }
}

function createCaptureInterval(
  state: MonitoringRuntimeState,
  emitter: EventEmitter | null,
  captureSnapshot: CaptureSnapshot,
): NodeJS.Timeout {
  return setInterval(() => {
    captureSnapshot().catch((err) => {
      console.error('[MonitoringService] Capture error:', err.message);
      emitter?.emit('error', err);
    });
  }, state.config.intervalSeconds * 1000);
}
