import { appendTrace, summarizeSnapshot } from './trace';
import { shouldRecommendVisualFallback } from './verification';
import type { WindowsUIAServiceCore } from './core';
import type { WindowsUIAArtifacts, WindowsUIAActionPayload, WindowsUIASnapshot } from './types';

export function primeState(service: WindowsUIAServiceCore, task: string, maxSteps: number, abort: AbortController, tracePath: string, reportPath: string): void {
  service.abortController = abort;
  service.status = 'executing';
  service.currentTask = task;
  service.currentStep = 0;
  service.currentMaxSteps = maxSteps;
  service.lastAction = null;
  service.lastVerification = null;
  service.lastTracePath = tracePath;
  service.lastReportPath = reportPath;
  service.lastScreenshotPath = null;
  service.lastRunResult = null;
}

export function emitStart(service: WindowsUIAServiceCore, task: string, maxSteps: number, artifacts: WindowsUIAArtifacts, startedAt: string): void {
  service.emit('task-started', {
    task,
    maxSteps,
    backend: 'windows_uia',
    taskId: artifacts.taskId,
    runDirectory: artifacts.runDirectory,
    tracePath: artifacts.tracePath,
  });
  appendTrace(artifacts.tracePath, { type: 'start', timestamp: startedAt, task, backend: 'windows_uia', maxSteps, taskId: artifacts.taskId });
}

export function resetState(service: WindowsUIAServiceCore): void {
  service.status = 'idle';
  service.currentTask = null;
  service.currentStep = 0;
  service.currentMaxSteps = 0;
  service.abortController = null;
  service.processQueue();
}

export function handleTerminalAction(service: WindowsUIAServiceCore, action: WindowsUIAActionPayload, step: number, artifacts: WindowsUIAArtifacts, snapshot: WindowsUIASnapshot) {
  if (action.action === 'done') return emitDone(service, action, step, artifacts);
  if (action.action !== 'fail') return null;
  return emitFailure(service, action, step, artifacts, snapshot);
}

function emitDone(service: WindowsUIAServiceCore, action: WindowsUIAActionPayload, step: number, artifacts: WindowsUIAArtifacts) {
  const message = action.message || 'Tarea UIA completada.';
  service.emit('task-completed', { message, steps: step, backend: 'windows_uia', taskId: artifacts.taskId, reportPath: artifacts.reportPath, tracePath: artifacts.tracePath, screenshotPath: artifacts.finalScreenshotPath });
  return { status: 'completed' as const, category: 'none' as const, message };
}

function emitFailure(service: WindowsUIAServiceCore, action: WindowsUIAActionPayload, step: number, artifacts: WindowsUIAArtifacts, snapshot: WindowsUIASnapshot) {
  const message = action.message || 'La tarea UIA no se pudo completar.';
  appendTrace(artifacts.tracePath, {
    type: 'step',
    timestamp: new Date().toISOString(),
    step,
    action,
    success: false,
    verification: message,
    before: summarizeSnapshot(snapshot, action.elementId),
    after: null,
    fallbackRecommended: shouldRecommendVisualFallback('explicit_fail'),
  });
  service.emit('task-failed', { message, steps: step, backend: 'windows_uia', taskId: artifacts.taskId, reportPath: artifacts.reportPath, tracePath: artifacts.tracePath, screenshotPath: artifacts.finalScreenshotPath });
  return { status: 'failed' as const, category: 'explicit_fail' as const, message };
}
