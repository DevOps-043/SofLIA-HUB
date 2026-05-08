import { powerMonitor } from 'electron';
import fs from 'node:fs/promises';
import type { EventEmitter } from 'node:events';
import { getActiveWindowInfo } from './active-window';
import { flushMonitoringBuffer, type MonitoringRuntimeState } from './service-state';

type TakeScreenshot = (timestamp: Date, displayId?: string) => Promise<string | undefined>;

export async function captureMonitoringSnapshot(
  state: MonitoringRuntimeState,
  emitter: EventEmitter,
  takeScreenshot: TakeScreenshot,
): Promise<void> {
  if (!state.isRunning) return;

  const timestamp = new Date();
  const windowInfo = await getActiveWindowInfo();
  if (windowInfo) {
    state.diagnostics.activeWinAvailable = true;
  } else {
    if (state.diagnostics.activeWinFailCount === 0) {
      emitter.emit('error', { message: 'No se puede detectar la ventana activa. El modulo active-win puede no estar disponible.' });
    }
    state.diagnostics.activeWinFailCount++;
  }

  const windowTitle = windowInfo?.title || 'Unknown';
  const processName = windowInfo?.process || 'Unknown';
  const idleSeconds = powerMonitor.getSystemIdleTime();
  const isIdle = idleSeconds >= state.config.idleThresholdSeconds;
  state.lastWindowTitle = windowTitle;

  let screenshotPath: string | undefined;
  if ((state.config.screenshotEnabled || state.config.semanticSnapshotEnabled) && !isIdle) {
    screenshotPath = await takeScreenshot(timestamp, state.config.targetDisplayId);
  }

  const ocrText = await maybeExtractOcrText(state.config.ocrEnabled, screenshotPath);
  const semanticSnapshot = await maybeReadSemanticSnapshot(Boolean(state.config.semanticSnapshotEnabled), isIdle, screenshotPath);
  if (screenshotPath && !state.config.screenshotEnabled) fs.unlink(screenshotPath).catch(() => {});

  const snapshot = {
    windowTitle,
    processName,
    url: windowInfo?.url,
    idle: isIdle,
    idleSeconds,
    screenshotPath: state.config.screenshotEnabled ? screenshotPath : undefined,
    ocrText,
    semanticSnapshot,
    timestamp,
  };

  state.snapshotCount++;
  state.snapshotBuffer.push(snapshot);
  state.allSnapshots.push(snapshot);
  emitter.emit('snapshot', snapshot);
  flushIfNeeded(state, emitter);
  console.log(`[MonitoringService] #${state.snapshotCount} | ${processName}: ${windowTitle.slice(0, 60)}${isIdle ? ' [IDLE]' : ''}`);
}

async function maybeExtractOcrText(enabled: boolean, screenshotPath?: string): Promise<string | undefined> {
  if (!enabled || !screenshotPath) return undefined;
  try {
    const { extractTextFromFile } = await import('../ocr-service');
    const text = await extractTextFromFile(screenshotPath);
    return text && text.length > 2000 ? text.slice(0, 2000) : text;
  } catch {
    return undefined;
  }
}

async function maybeReadSemanticSnapshot(enabled: boolean, isIdle: boolean, screenshotPath?: string): Promise<string | undefined> {
  if (!enabled || isIdle || !screenshotPath) return undefined;
  try {
    return (await fs.readFile(screenshotPath)).toString('base64');
  } catch (err) {
    console.error('[MonitoringService] Failed to generate semantic snapshot base64:', err);
    return undefined;
  }
}

function flushIfNeeded(state: MonitoringRuntimeState, emitter: EventEmitter): void {
  if (state.snapshotBuffer.length < 2) return;
  emitter.emit('flush', {
    userId: state.userId,
    sessionId: state.sessionId,
    snapshots: flushMonitoringBuffer(state),
  });
}
