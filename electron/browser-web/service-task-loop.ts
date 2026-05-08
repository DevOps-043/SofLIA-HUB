import { inferStartUrl } from './normalizers';
import { waitForBrowserPageSettled } from './action-executor';
import { verifyBrowserActionOutcome } from './verifiers';
import type { BrowserTaskArtifacts, BrowserTaskOptions } from './types';
import type { BrowserTaskMutableState } from './service-types';

export async function runBrowserTaskLoop(
  service: any,
  params: {
    task: string;
    options?: BrowserTaskOptions;
    maxSteps: number;
    taskAbort: AbortController;
    artifacts: BrowserTaskArtifacts;
    state: BrowserTaskMutableState;
  },
): Promise<string> {
  if (params.options?.resetProfile) await service.resetProfile(params.options.profileId || 'default');
  const page = await service.ensurePage(params.options);
  const traceStartResult = await service.startTaskTrace();
  params.state.traceStarted = traceStartResult.success;
  params.state.traceStartError = traceStartResult.error;
  await navigateToStartUrlIfNeeded(service, page, params.task, params.options);

  for (let step = 0; step < params.maxSteps; step++) {
    if (params.taskAbort.signal.aborted) return finishState(params.state, 'cancelled', 'Tarea cancelada por el usuario.');
    const outcome = await runBrowserTaskStep(service, page, params, step + 1);
    if (outcome.done) return outcome.message;
  }

  const lastEntry = params.state.history[params.state.history.length - 1];
  const lastMessage = lastEntry?.action.message || 'Sin resultado final.';
  const timeoutMessage = `Se alcanzo el limite de pasos del backend web. ${lastMessage}`;
  emitTaskFailed(service, params.artifacts, timeoutMessage, params.maxSteps);
  return finishState(params.state, 'failed', timeoutMessage);
}

async function navigateToStartUrlIfNeeded(service: any, page: any, task: string, options?: BrowserTaskOptions): Promise<void> {
  const startUrl = inferStartUrl(task, options?.startUrl);
  if (startUrl && service.shouldNavigateToStartUrl(page, startUrl)) {
    await page.goto(startUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await waitForBrowserPageSettled(page);
  }
  service.currentUrl = page.url();
}

async function runBrowserTaskStep(service: any, page: any, params: any, step: number): Promise<{ done: boolean; message: string }> {
  service.currentStep = step;
  const beforeSnapshot = await service.collectSnapshot(page);
  params.state.finalSnapshot = beforeSnapshot;
  service.currentUrl = beforeSnapshot.url;
  const action = await service.decideNextAction(params.task, beforeSnapshot, params.state.history);
  service.lastAction = action.message || action.action;
  service.emit('step', { step, maxSteps: params.maxSteps, backend: 'browser_web', action });
  if (action.action === 'done') return completeTask(service, params, action.message || 'Tarea web completada.', step);
  if (action.action === 'fail') return failTask(service, params, action.message || 'La tarea web no se pudo completar.', step);

  const result = await executeAndVerifyBrowserAction(service, page, action, beforeSnapshot);
  params.state.finalSnapshot = result.afterSnapshot || params.state.finalSnapshot;
  params.state.history.push({ step, action, success: result.success, error: result.errorMessage || undefined, verification: result.verificationMessage || undefined, url: page.url(), title: await page.title().catch(() => '') });
  service.emit('step-result', { step, maxSteps: params.maxSteps, backend: 'browser_web', success: result.success, verification: result.verificationMessage, action });
  if (!result.success && params.state.history.slice(-3).filter((entry: any) => !entry.success).length >= 3) {
    return failTask(service, params, `Fallo persistente en browser_web: ${result.errorMessage || 'sin detalle'}`, step);
  }
  return { done: false, message: '' };
}

async function executeAndVerifyBrowserAction(service: any, page: any, action: any, beforeSnapshot: any) {
  try {
    await service.executeAction(page, action);
    const afterSnapshot = await service.collectSnapshot(page);
    service.currentUrl = afterSnapshot.url;
    const verification = verifyBrowserActionOutcome(action, beforeSnapshot, afterSnapshot);
    service.lastVerification = verification.message;
    return { success: verification.success, errorMessage: verification.success ? '' : verification.message, verificationMessage: verification.message, afterSnapshot };
  } catch (err: any) {
    const errorMessage = err.message || 'Error desconocido';
    service.lastVerification = errorMessage;
    return { success: false, errorMessage, verificationMessage: errorMessage, afterSnapshot: null };
  }
}

function completeTask(service: any, params: any, message: string, steps: number) {
  service.emit('task-completed', buildTaskEvent(params.artifacts, message, steps));
  return { done: true, message: finishState(params.state, 'completed', message) };
}

function failTask(service: any, params: any, message: string, steps: number) {
  emitTaskFailed(service, params.artifacts, message, steps);
  return { done: true, message: finishState(params.state, 'failed', message) };
}

function emitTaskFailed(service: any, artifacts: BrowserTaskArtifacts, message: string, steps: number): void {
  service.emit('task-failed', buildTaskEvent(artifacts, message, steps));
}

function buildTaskEvent(artifacts: BrowserTaskArtifacts, message: string, steps: number) {
  return { message, steps, backend: 'browser_web', taskId: artifacts.taskId, reportPath: artifacts.reportPath, tracePath: artifacts.tracePath, screenshotPath: artifacts.finalScreenshotPath };
}

function finishState(state: BrowserTaskMutableState, status: BrowserTaskMutableState['finalStatus'], message: string): string {
  state.finalStatus = status;
  state.finalMessage = message;
  return message;
}
