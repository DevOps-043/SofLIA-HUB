import { desktopCapturer } from 'electron';
import type { MonitoringRuntimeState } from './state';
import { takeMonitoringScreenshot } from './take-screenshot';

interface ServiceScreenshotOptions {
  displayId?: string;
  emitError: (message: string) => void;
  sharp: any;
  state: MonitoringRuntimeState;
  timestamp: Date;
}

export function takeMonitoringServiceScreenshot(options: ServiceScreenshotOptions): Promise<string | undefined> {
  const { displayId, emitError, sharp, state, timestamp } = options;
  return takeMonitoringScreenshot({
    desktopCapturerApi: desktopCapturer,
    diagnostics: state.diagnostics,
    displayId,
    emitError,
    screenshotDir: state.screenshotDir,
    sharp,
    timestamp,
  });
}
