import { getActiveWindowInfo } from './active-window';
import { deleteTransientScreenshot, readOcrText, readSemanticSnapshot } from './snapshot-enrichment';
import type { ActivitySnapshot, MonitoringConfig, MonitoringDiagnostics } from './types';

interface CaptureMonitoringSnapshotInput {
  config: MonitoringConfig;
  diagnostics: MonitoringDiagnostics;
  emitError: (message: string) => void;
  getIdleSeconds: () => number;
  isRunning: boolean;
  takeScreenshot: (timestamp: Date, displayId?: string) => Promise<string | undefined>;
}

export interface CaptureMonitoringSnapshotResult {
  idle: boolean;
  processName: string;
  snapshot: ActivitySnapshot;
  windowTitle: string;
}

export async function captureMonitoringSnapshot(
  input: CaptureMonitoringSnapshotInput,
): Promise<CaptureMonitoringSnapshotResult | null> {
  if (!input.isRunning) return null;

  const timestamp = new Date();
  const windowInfo = await getActiveWindowInfo();
  if (windowInfo) {
    input.diagnostics.activeWinAvailable = true;
  } else {
    if (input.diagnostics.activeWinFailCount === 0) {
      input.emitError('No se puede detectar la ventana activa. El modulo active-win puede no estar disponible.');
    }
    input.diagnostics.activeWinFailCount++;
  }

  const windowTitle = windowInfo?.title || 'Unknown';
  const processName = windowInfo?.process || 'Unknown';
  const idleSeconds = input.getIdleSeconds();
  const idle = idleSeconds >= input.config.idleThresholdSeconds;
  const needsScreenshot = input.config.screenshotEnabled || input.config.semanticSnapshotEnabled;
  const screenshotPath = needsScreenshot && !idle
    ? await input.takeScreenshot(timestamp, input.config.targetDisplayId)
    : undefined;
  const ocrText = await readOcrText(input.config.ocrEnabled, screenshotPath);
  const semanticSnapshot = await readSemanticSnapshot(input.config.semanticSnapshotEnabled, idle, screenshotPath);
  deleteTransientScreenshot(screenshotPath, input.config.screenshotEnabled);

  return {
    idle,
    processName,
    windowTitle,
    snapshot: {
      windowTitle,
      processName,
      url: windowInfo?.url,
      idle,
      idleSeconds,
      screenshotPath: input.config.screenshotEnabled ? screenshotPath : undefined,
      ocrText,
      semanticSnapshot,
      timestamp,
    },
  };
}
