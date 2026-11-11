import type { BrowserWebService } from '../browser-web-service';
import { createBrowserTaskArtifacts, startBrowserTaskTrace } from './artifacts';
import { AsyncResource } from 'node:async_hooks';
import { assertBackendTaskActive, linkBackendTaskCancellation } from '../desktop-agent/task-cancellation';
import { finalizeBrowserTaskArtifacts } from './service-artifacts';
import { runBrowserTaskLoop } from './service-task-loop';
import type { BrowserTaskOptions } from './types';
import type { BrowserTaskMutableState, BrowserWebConstructor, BrowserWebRuntimeApi } from './service-types';

export function attachBrowserWebRuntime(Service: BrowserWebConstructor): void {
  Object.assign(Service.prototype, {
    async executeTask(task: string, options?: BrowserTaskOptions) {
      if (this.status !== 'idle') {
        return new Promise<string>((resolve, reject) => {
          this.queue.push({ task, options, resolve, reject, execute: AsyncResource.bind(() => {
            if (options?.signal?.aborted) return Promise.reject(new Error('Tarea web revocada antes de ejecutar.'));
            return this.executeTaskInternal(task, options);
          }) });
          this.emit('task-queued', { task, queuePosition: this.queue.length, backend: 'browser_web' });
        });
      }
      return this.executeTaskInternal(task, options);
    },
    async executeTaskInternal(task: string, options?: BrowserTaskOptions) {
      if (options?.signal?.aborted) throw new Error('Tarea web revocada antes de ejecutar.');
      const run = prepareBrowserTaskRun(this, task, options);
      const dispose = linkBackendTaskCancellation(run.taskAbort, options?.signal);
      try {
        assertBackendTaskActive(run.taskAbort.signal);
        this.emit('task-started', { task, maxSteps: run.maxSteps, backend: 'browser_web', taskId: run.artifacts.taskId, runDirectory: run.artifacts.runDirectory });
        assertBackendTaskActive(run.taskAbort.signal);
        const result = await runBrowserTaskLoop(this, { task, options, ...run });
        assertBackendTaskActive(run.taskAbort.signal);
        return result;
      } catch (err: unknown) {
        if (run.taskAbort.signal.aborted) {
          run.state.finalStatus = 'cancelled';
          run.state.finalMessage = 'Tarea cancelada por el usuario.';
          return run.state.finalMessage;
        }
        run.state.finalStatus = 'error';
        run.state.finalMessage = err instanceof Error ? err.message : 'Error en browser_web';
        this.lastVerification = run.state.finalMessage;
        this.emit('task-failed', { message: run.state.finalMessage, steps: this.currentStep, backend: 'browser_web', error: run.state.finalMessage, taskId: run.artifacts.taskId, reportPath: run.artifacts.reportPath, tracePath: run.artifacts.tracePath, screenshotPath: run.artifacts.finalScreenshotPath });
        throw err;
      } finally {
        try {
          await this.finalizeTaskArtifacts({ artifacts: run.artifacts, task, options, signal: run.taskAbort.signal, startedAt: run.startedAt, finishedAt: new Date().toISOString(), ...run.state });
        } finally { dispose(); resetBrowserTaskRun(this); }
      }
    },
    createTaskArtifacts: (task: string) => createBrowserTaskArtifacts(task),
    startTaskTrace() {
      return startBrowserTaskTrace(this.context);
    },
    finalizeTaskArtifacts(params) {
      return finalizeBrowserTaskArtifacts(this, params);
    },
  } satisfies BrowserWebRuntimeApi & ThisType<BrowserWebService>);
}

function prepareBrowserTaskRun(service: BrowserWebService, task: string, options?: BrowserTaskOptions) {
  const maxSteps = options?.maxSteps ?? 40;
  const taskAbort = new AbortController();
  const artifacts = service.createTaskArtifacts(task);
  const state: BrowserTaskMutableState = { history: [], finalSnapshot: null, finalStatus: 'failed', finalMessage: '', traceStarted: false, traceStartError: null };
  Object.assign(service, { abortController: taskAbort, status: 'executing', currentTask: task, currentStep: 0, currentMaxSteps: maxSteps, lastAction: null, lastVerification: null, lastTracePath: null, lastReportPath: artifacts.reportPath, lastScreenshotPath: null });
  return { maxSteps, taskAbort, artifacts, startedAt: new Date().toISOString(), state };
}

function resetBrowserTaskRun(service: BrowserWebService): void {
  service.status = 'idle';
  service.currentTask = null;
  service.currentStep = 0;
  service.currentMaxSteps = 0;
  service.abortController = null;
  try { service.currentUrl = service.page && !service.page.isClosed() ? service.page.url() : null; }
  catch { service.currentUrl = null; }
  finally { service.processQueue(); }
}
