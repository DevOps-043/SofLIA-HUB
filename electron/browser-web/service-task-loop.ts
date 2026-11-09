import type { Page } from 'playwright-core';
import type { BrowserWebService } from '../browser-web-service';
import { assertBackendTaskActive, runBackendTaskStage } from '../desktop-agent/task-cancellation';
import { inferStartUrl } from './normalizers';
import { waitForBrowserPageSettled } from './action-executor';
import { verifyBrowserActionOutcome } from './verifiers';
import type { BrowserActionPayload, BrowserPageSnapshot, BrowserTaskArtifacts, BrowserTaskOptions } from './types';
import type { BrowserTaskMutableState } from './service-types';

interface BrowserTaskLoopParams {
  task: string;
  options?: BrowserTaskOptions;
  maxSteps: number;
  taskAbort: AbortController;
  artifacts: BrowserTaskArtifacts;
  state: BrowserTaskMutableState;
}

export async function runBrowserTaskLoop(service: BrowserWebService, params: BrowserTaskLoopParams): Promise<string> {
  const signal = params.taskAbort.signal;
  assertBackendTaskActive(signal);
  if (params.options?.resetProfile) await runBackendTaskStage(signal, () => service.resetProfile(params.options?.profileId || 'default'));
  const page: Page = await runBackendTaskStage(signal, () => service.ensurePage(params.options));
  const traceStartResult = await service.startTaskTrace();
  // Registrar el recurso iniciado antes de comprobar revocación, para poder cerrarlo.
  params.state.traceStarted = traceStartResult.success;
  params.state.traceStartError = traceStartResult.error;
  assertBackendTaskActive(signal);
  await navigateToStartUrlIfNeeded(service, page, params, signal);
  for (let step = 1; step <= params.maxSteps; step++) {
    assertBackendTaskActive(signal);
    const outcome = await runBrowserTaskStep(service, page, params, step);
    if (outcome.done) return outcome.message;
  }
  const lastMessage = params.state.history[params.state.history.length - 1]?.action.message || 'Sin resultado final.';
  const message = `Se alcanzo el limite de pasos del backend web. ${lastMessage}`;
  emitTaskFailed(service, params.artifacts, message, params.maxSteps);
  return finishState(params.state, 'failed', message);
}

async function navigateToStartUrlIfNeeded(service: BrowserWebService, page: Page, params: BrowserTaskLoopParams, signal: AbortSignal): Promise<void> {
  const startUrl = inferStartUrl(params.task, params.options?.startUrl);
  if (startUrl && service.shouldNavigateToStartUrl(page, startUrl)) {
    await runBackendTaskStage(signal, () => page.goto(startUrl, { waitUntil: 'domcontentloaded', timeout: 20000 }));
    await waitForBrowserPageSettled(page, signal);
  }
  assertBackendTaskActive(signal);
  service.currentUrl = page.url();
}

async function runBrowserTaskStep(service: BrowserWebService, page: Page, params: BrowserTaskLoopParams, step: number): Promise<{ done: boolean; message: string }> {
  const signal = params.taskAbort.signal;
  service.currentStep = step;
  const before = await runBackendTaskStage(signal, () => service.collectSnapshot(page, signal));
  params.state.finalSnapshot = before;
  service.currentUrl = before.url;
  const action = await runBackendTaskStage(signal, () => service.decideNextAction(params.task, before, params.state.history, signal));
  service.lastAction = action.message || action.action;
  service.emit('step', { step, maxSteps: params.maxSteps, backend: 'browser_web', action });
  assertBackendTaskActive(signal);
  if (action.action === 'done') return completeTask(service, params, action.message || 'Tarea web completada.', step);
  if (action.action === 'fail') return failTask(service, params, action.message || 'La tarea web no se pudo completar.', step);
  const result = await executeAndVerifyBrowserAction(service, page, action, before, signal);
  params.state.finalSnapshot = result.afterSnapshot || params.state.finalSnapshot;
  const title = await runBackendTaskStage(signal, () => page.title().catch(() => ''));
  params.state.history.push({ step, action, success: result.success, error: result.errorMessage || undefined, verification: result.verificationMessage || undefined, url: page.url(), title });
  service.emit('step-result', { step, maxSteps: params.maxSteps, backend: 'browser_web', success: result.success, verification: result.verificationMessage, action });
  assertBackendTaskActive(signal);
  if (!result.success && params.state.history.slice(-3).filter(entry => !entry.success).length >= 3) return failTask(service, params, `Fallo persistente en browser_web: ${result.errorMessage || 'sin detalle'}`, step);
  return { done: false, message: '' };
}

async function executeAndVerifyBrowserAction(service: BrowserWebService, page: Page, action: BrowserActionPayload, before: BrowserPageSnapshot, signal: AbortSignal) {
  try {
    await runBackendTaskStage(signal, () => service.executeAction(page, action, signal));
    const afterSnapshot = await runBackendTaskStage(signal, () => service.collectSnapshot(page, signal));
    service.currentUrl = afterSnapshot.url;
    const verification = verifyBrowserActionOutcome(action, before, afterSnapshot);
    service.lastVerification = verification.message;
    return { success: verification.success, errorMessage: verification.success ? '' : verification.message, verificationMessage: verification.message, afterSnapshot };
  } catch (error: unknown) {
    assertBackendTaskActive(signal);
    const message = error instanceof Error ? error.message : 'Error desconocido';
    service.lastVerification = message;
    return { success: false, errorMessage: message, verificationMessage: message, afterSnapshot: null };
  }
}

function completeTask(service: BrowserWebService, params: BrowserTaskLoopParams, message: string, steps: number) {
  service.emit('task-completed', buildTaskEvent(params.artifacts, message, steps));
  return { done: true, message: finishState(params.state, 'completed', message) };
}
function failTask(service: BrowserWebService, params: BrowserTaskLoopParams, message: string, steps: number) {
  emitTaskFailed(service, params.artifacts, message, steps);
  return { done: true, message: finishState(params.state, 'failed', message) };
}
function emitTaskFailed(service: BrowserWebService, artifacts: BrowserTaskArtifacts, message: string, steps: number): void { service.emit('task-failed', buildTaskEvent(artifacts, message, steps)); }
function buildTaskEvent(artifacts: BrowserTaskArtifacts, message: string, steps: number) { return { message, steps, backend: 'browser_web', taskId: artifacts.taskId, reportPath: artifacts.reportPath, tracePath: artifacts.tracePath, screenshotPath: artifacts.finalScreenshotPath }; }
function finishState(state: BrowserTaskMutableState, status: BrowserTaskMutableState['finalStatus'], message: string): string { state.finalStatus = status; state.finalMessage = message; return message; }
