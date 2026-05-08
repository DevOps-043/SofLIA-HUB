import fs from 'node:fs';
import { appendTrace } from './trace';
import { shouldRecommendVisualFallback } from './verification';
import type { WindowsUIAServiceCore } from './core';
import type { WindowsUIAArtifacts, WindowsUIAFailureCategory, WindowsUIAHistoryEntry, WindowsUIASnapshot } from './types';

export async function finalizeArtifacts(
  service: WindowsUIAServiceCore,
  artifacts: WindowsUIAArtifacts,
  task: string,
  startedAt: string,
  finishedAt: string,
  status: 'completed' | 'failed' | 'cancelled' | 'error',
  message: string,
  failureCategory: WindowsUIAFailureCategory,
  history: WindowsUIAHistoryEntry[],
  finalSnapshot: WindowsUIASnapshot | null,
): Promise<void> {
  if (finalSnapshot?.screenshotBase64) {
    try {
      fs.writeFileSync(artifacts.finalScreenshotPath, Buffer.from(finalSnapshot.screenshotBase64, 'base64'));
      service.lastScreenshotPath = artifacts.finalScreenshotPath;
    } catch {
      service.lastScreenshotPath = null;
    }
  }

  const fallbackRecommended = shouldRecommendVisualFallback(failureCategory);
  appendTrace(artifacts.tracePath, {
    type: 'final',
    timestamp: finishedAt,
    status,
    message,
    failureCategory,
    fallbackRecommended,
    currentWindowTitle: finalSnapshot?.currentWindowTitle || service.currentWindowTitle,
    currentProcess: finalSnapshot?.currentProcess || '',
  });

  const report = {
    taskId: artifacts.taskId,
    task,
    backend: 'windows_uia',
    status,
    message,
    failureCategory,
    fallbackRecommended,
    startedAt,
    finishedAt,
    currentWindowTitle: finalSnapshot?.currentWindowTitle || service.currentWindowTitle,
    currentProcess: finalSnapshot?.currentProcess || '',
    lastAction: service.lastAction,
    lastVerification: service.lastVerification,
    artifacts: { ...artifacts, finalScreenshotPath: service.lastScreenshotPath },
    history,
  };

  try {
    fs.writeFileSync(artifacts.reportPath, JSON.stringify(report, null, 2), 'utf-8');
    service.lastReportPath = artifacts.reportPath;
  } catch {
    service.lastReportPath = null;
  }
  service.lastTracePath = artifacts.tracePath;
  service.lastRunResult = {
    status,
    message,
    failureCategory,
    fallbackRecommended,
    verification: service.lastVerification,
    reportPath: service.lastReportPath,
    tracePath: service.lastTracePath,
    screenshotPath: service.lastScreenshotPath,
  };
}
