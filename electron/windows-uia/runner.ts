import { createArtifacts } from './artifacts';
import { assertBackendTaskActive, linkBackendTaskCancellation, runBackendTaskStage } from '../desktop-agent/task-cancellation';
import { finalizeArtifacts } from './finalize';
import { findLikelyWindow } from './window-match';
import { collectSnapshot } from './snapshot';
import { decideNextAction } from './planner';
import { executeActionStep, pushHistory } from './step-runner';
import { appendTrace, summarizeSnapshot } from './trace';
import { emitStart, handleTerminalAction, primeState, resetState } from './runner-state';
import type { WindowsUIAServiceCore } from './core';
import type { WindowsUIAFailureCategory, WindowsUIAHistoryEntry, WindowsUIASnapshot, WindowsUIATaskOptions } from './types';

export async function executeTaskInternal(
  service: WindowsUIAServiceCore,
  task: string,
  options?: WindowsUIATaskOptions,
): Promise<string> {
  if (options?.signal?.aborted) throw new Error('Tarea UIA revocada antes de ejecutar.');
  const maxSteps = options?.maxSteps ?? 30;
  const artifacts = createArtifacts(task);
  const taskAbort = new AbortController();
  const dispose = linkBackendTaskCancellation(taskAbort, options?.signal);
  const signal = taskAbort.signal;
  const startedAt = new Date().toISOString();
  const history: WindowsUIAHistoryEntry[] = [];
  let finalSnapshot: WindowsUIASnapshot | null = null;
  let finalMessage = '';
  let finalStatus: 'completed' | 'failed' | 'cancelled' | 'error' = 'failed';
  let finalFailureCategory: WindowsUIAFailureCategory = 'none';
  try {
    primeState(service, task, maxSteps, taskAbort, artifacts.tracePath, artifacts.reportPath);
    assertBackendTaskActive(signal);
    emitStart(service, task, maxSteps, artifacts, startedAt);
    assertBackendTaskActive(signal);
    const windows = await runBackendTaskStage(signal, () => service.desktopAgent.listWindows());
    const likelyWindow = findLikelyWindow(task, windows);
    if (likelyWindow) await runBackendTaskStage(signal, () => service.desktopAgent.focusWindow(likelyWindow.title).catch(() => {}));
    let snapshot = await runBackendTaskStage(signal, () => collectSnapshot(service, signal));
    finalSnapshot = snapshot;
    if (snapshot.windows.length === 0) throwFailure('no_window', 'No hay ventanas activas para operar con windows_uia.');
    if (snapshot.elements.length === 0) throwFailure('no_elements', 'No se detectaron elementos UIA interactivos en la ventana activa.');

    appendTrace(artifacts.tracePath, { type: 'snapshot', timestamp: new Date().toISOString(), phase: 'initial', snapshot: summarizeSnapshot(snapshot) });
    for (let step = 1; step <= maxSteps; step++) {
      assertBackendTaskActive(signal);
      service.currentStep = step;
      snapshot = await runBackendTaskStage(signal, () => collectSnapshot(service, signal));
      finalSnapshot = snapshot;
      service.currentWindowTitle = snapshot.currentWindowTitle;
      const action = await runBackendTaskStage(signal, () => decideNextAction(service, task, snapshot, history, signal));
      service.lastAction = action.message || action.action;
      service.emit('step', { step, maxSteps, backend: 'windows_uia', action });
      assertBackendTaskActive(signal);
      const terminal = handleTerminalAction(service, action, step, artifacts, snapshot);
      if (terminal) { finalStatus = terminal.status; finalFailureCategory = terminal.category; finalMessage = terminal.message; return finalMessage; }

      const result = await runBackendTaskStage(signal, () => executeActionStep(service, action, snapshot, step, artifacts.tracePath, signal));
      finalSnapshot = result.afterSnapshot || finalSnapshot;
      pushHistory(history, step, action, result.success, result.errorMessage, result.verificationMessage, service.currentWindowTitle);
      service.emit('step-result', { step, maxSteps, backend: 'windows_uia', success: result.success, verification: result.verificationMessage, action });
      assertBackendTaskActive(signal);
      if (!result.success && history.slice(-3).filter((entry) => !entry.success).length >= 3) {
        finalStatus = 'failed'; finalFailureCategory = 'verification';
        finalMessage = `Fallo persistente en windows_uia: ${result.errorMessage || 'sin detalle'}`;
        service.emit('task-failed', { message: finalMessage, steps: step, backend: 'windows_uia', taskId: artifacts.taskId, reportPath: artifacts.reportPath, tracePath: artifacts.tracePath, screenshotPath: artifacts.finalScreenshotPath });
        return finalMessage;
      }
    }
    finalStatus = 'failed'; finalFailureCategory = 'timeout'; finalMessage = 'Se alcanzo el limite de pasos del backend windows_uia.';
    service.emit('task-failed', { message: finalMessage, steps: maxSteps, backend: 'windows_uia', taskId: artifacts.taskId, reportPath: artifacts.reportPath, tracePath: artifacts.tracePath, screenshotPath: artifacts.finalScreenshotPath });
    return finalMessage;
  } catch (err: unknown) {
    if (signal.aborted) {
      finalStatus = 'cancelled'; finalFailureCategory = 'cancelled'; finalMessage = 'Tarea cancelada por el usuario.'; return finalMessage;
    }
    finalStatus = 'error'; if (finalFailureCategory === 'none') finalFailureCategory = errorCategory(err);
    finalMessage = err instanceof Error ? err.message : 'Error en windows_uia'; service.lastVerification = finalMessage;
    service.emit('task-failed', { message: finalMessage, steps: service.currentStep, backend: 'windows_uia', error: finalMessage, taskId: artifacts.taskId, reportPath: artifacts.reportPath, tracePath: artifacts.tracePath, screenshotPath: artifacts.finalScreenshotPath });
    throw err;
  } finally {
    try {
      await finalizeArtifacts(service, artifacts, task, startedAt, new Date().toISOString(), finalStatus, finalMessage, finalFailureCategory, history, finalSnapshot);
    } finally { dispose(); resetState(service); }
  }
}

function errorCategory(error: unknown): WindowsUIAFailureCategory {
  const category = error instanceof Error && 'failureCategory' in error ? error.failureCategory : undefined;
  switch (category) {
    case 'explicit_fail': case 'verification': case 'timeout': case 'no_elements': case 'no_window': case 'cancelled': return category;
    default: return 'error';
  }
}

function throwFailure(category: WindowsUIAFailureCategory, message: string): never {
  const error = new Error(message) as Error & { failureCategory: WindowsUIAFailureCategory };
  error.failureCategory = category; throw error;
}
