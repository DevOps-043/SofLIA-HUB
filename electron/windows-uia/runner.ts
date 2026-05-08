import { createArtifacts } from './artifacts';
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
  const maxSteps = options?.maxSteps ?? 30;
  const artifacts = createArtifacts(task);
  const taskAbort = new AbortController();
  const startedAt = new Date().toISOString();
  const history: WindowsUIAHistoryEntry[] = [];
  let finalSnapshot: WindowsUIASnapshot | null = null;
  let finalMessage = '';
  let finalStatus: 'completed' | 'failed' | 'cancelled' | 'error' = 'failed';
  let finalFailureCategory: WindowsUIAFailureCategory = 'none';
  primeState(service, task, maxSteps, taskAbort, artifacts.tracePath, artifacts.reportPath);
  emitStart(service, task, maxSteps, artifacts, startedAt);

  try {
    const windows = await service.desktopAgent.listWindows();
    const likelyWindow = findLikelyWindow(task, windows);
    if (likelyWindow) await service.desktopAgent.focusWindow(likelyWindow.title).catch(() => {});
    let snapshot = await collectSnapshot(service);
    finalSnapshot = snapshot;
    if (snapshot.windows.length === 0) throwFailure('no_window', 'No hay ventanas activas para operar con windows_uia.');
    if (snapshot.elements.length === 0) throwFailure('no_elements', 'No se detectaron elementos UIA interactivos en la ventana activa.');

    appendTrace(artifacts.tracePath, { type: 'snapshot', timestamp: new Date().toISOString(), phase: 'initial', snapshot: summarizeSnapshot(snapshot) });
    for (let step = 1; step <= maxSteps; step++) {
      if (taskAbort.signal.aborted) {
        finalStatus = 'cancelled'; finalFailureCategory = 'cancelled'; finalMessage = 'Tarea cancelada por el usuario.'; return finalMessage;
      }
      service.currentStep = step;
      snapshot = await collectSnapshot(service);
      finalSnapshot = snapshot;
      service.currentWindowTitle = snapshot.currentWindowTitle;
      const action = await decideNextAction(service, task, snapshot, history);
      service.lastAction = action.message || action.action;
      service.emit('step', { step, maxSteps, backend: 'windows_uia', action });
      const terminal = handleTerminalAction(service, action, step, artifacts, snapshot);
      if (terminal) { finalStatus = terminal.status; finalFailureCategory = terminal.category; finalMessage = terminal.message; return finalMessage; }

      const result = await executeActionStep(service, action, snapshot, step, artifacts.tracePath);
      finalSnapshot = result.afterSnapshot || finalSnapshot;
      pushHistory(history, step, action, result.success, result.errorMessage, result.verificationMessage, service.currentWindowTitle);
      service.emit('step-result', { step, maxSteps, backend: 'windows_uia', success: result.success, verification: result.verificationMessage, action });
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
  } catch (err: any) {
    finalStatus = 'error'; if (finalFailureCategory === 'none') finalFailureCategory = err.failureCategory || 'error';
    finalMessage = err.message || 'Error en windows_uia'; service.lastVerification = finalMessage;
    service.emit('task-failed', { message: finalMessage, steps: service.currentStep, backend: 'windows_uia', error: finalMessage, taskId: artifacts.taskId, reportPath: artifacts.reportPath, tracePath: artifacts.tracePath, screenshotPath: artifacts.finalScreenshotPath });
    throw err;
  } finally {
    await finalizeArtifacts(service, artifacts, task, startedAt, new Date().toISOString(), finalStatus, finalMessage, finalFailureCategory, history, finalSnapshot);
    resetState(service);
  }
}

function throwFailure(category: WindowsUIAFailureCategory, message: string): never {
  const error = new Error(message) as Error & { failureCategory: WindowsUIAFailureCategory };
  error.failureCategory = category; throw error;
}
