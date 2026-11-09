import fs from 'node:fs';
import type { BrowserWebService } from '../browser-web-service';
import type {
  BrowserHistoryEntry,
  BrowserPageSnapshot,
  BrowserTaskArtifacts,
  BrowserTaskOptions,
} from './types';
import type { BrowserTaskFinalStatus } from './service-types';

export type FinalizeBrowserTaskArtifactsParams = {
  signal?: AbortSignal;
  artifacts: BrowserTaskArtifacts;
  task: string;
  options?: BrowserTaskOptions;
  history: BrowserHistoryEntry[];
  startedAt: string;
  finishedAt: string;
  finalStatus: BrowserTaskFinalStatus;
  finalMessage: string;
  traceStarted: boolean;
  traceStartError: string | null;
  finalSnapshot: BrowserPageSnapshot | null;
};

export async function finalizeBrowserTaskArtifacts(service: BrowserWebService, params: FinalizeBrowserTaskArtifactsParams): Promise<void> {
  const finalSnapshot = await resolveFinalSnapshot(service, params.finalSnapshot, params.signal);
  const trace = await stopTrace(service, params.artifacts.tracePath, params.traceStarted, params.traceStartError);
  const screenshotPath = writeFinalScreenshot(params.artifacts.finalScreenshotPath, finalSnapshot);
  const report = {
    taskId: params.artifacts.taskId,
    task: params.task,
    options: params.options || {},
    backend: 'browser_web',
    status: params.finalStatus,
    message: params.finalMessage,
    profile: { id: service.currentProfileId, mode: service.currentProfileMode },
    startedAt: params.startedAt,
    finishedAt: params.finishedAt,
    finalUrl: finalSnapshot?.url || service.currentUrl,
    finalTitle: finalSnapshot?.title || '',
    currentStep: service.currentStep,
    maxSteps: service.currentMaxSteps,
    lastAction: service.lastAction,
    lastVerification: service.lastVerification,
    trace,
    artifacts: {
      runDirectory: params.artifacts.runDirectory,
      reportPath: params.artifacts.reportPath,
      finalScreenshotPath: screenshotPath,
    },
    history: params.history,
  };
  try {
    fs.writeFileSync(params.artifacts.reportPath, JSON.stringify(report, null, 2), 'utf-8');
    service.lastReportPath = params.artifacts.reportPath;
  } catch {
    service.lastReportPath = null;
  }
  service.lastTracePath = trace.path;
  service.lastScreenshotPath = screenshotPath;
}

async function resolveFinalSnapshot(service: BrowserWebService, snapshot: BrowserPageSnapshot | null, signal?: AbortSignal) {
  if (snapshot || signal?.aborted || !service.page || service.page.isClosed()) return snapshot;
  return service.collectSnapshot(service.page, signal).catch(() => null);
}

async function stopTrace(service: BrowserWebService, tracePath: string, traceStarted: boolean, startError: string | null) {
  let stopError: string | null = null;
  let path: string | null = null;
  if (traceStarted && service.context?.tracing) {
    try {
      await service.context.tracing.stop({ path: tracePath });
      if (fs.existsSync(tracePath)) path = tracePath;
    } catch (err: unknown) {
      stopError = err instanceof Error ? err.message : 'No se pudo guardar el trace de Playwright.';
    }
  }
  return { path, startError, stopError };
}

function writeFinalScreenshot(targetPath: string, snapshot: BrowserPageSnapshot | null): string | null {
  if (!snapshot?.screenshotBase64) return null;
  try {
    fs.writeFileSync(targetPath, Buffer.from(snapshot.screenshotBase64, 'base64'));
    return targetPath;
  } catch {
    return null;
  }
}
