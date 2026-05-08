import { createBrowserTaskArtifacts, startBrowserTaskTrace } from './artifacts';
import { finalizeBrowserTaskArtifacts } from './service-artifacts';
import { runBrowserTaskLoop } from './service-task-loop';
import type { BrowserTaskOptions } from './types';
import type { BrowserTaskMutableState, BrowserWebConstructor, BrowserWebRuntimeApi } from './service-types';

export function attachBrowserWebRuntime(Service: BrowserWebConstructor): void {
  Object.assign(Service.prototype, {
    async executeTask(task: string, options?: BrowserTaskOptions) {
      if (!this.apiKey) throw new Error('API key de Gemini no configurada para BrowserWebService.');
      if (this.status !== 'idle') {
        return new Promise<string>((resolve, reject) => {
          this.queue.push({ task, options, resolve, reject });
          this.emit('task-queued', { task, queuePosition: this.queue.length, backend: 'browser_web' });
        });
      }
      return this.executeTaskInternal(task, options);
    },
    async executeTaskInternal(task: string, options?: BrowserTaskOptions) {
      const run = prepareBrowserTaskRun(this, task, options);
      try {
        return await runBrowserTaskLoop(this, { task, options, ...run });
      } catch (err: any) {
        run.state.finalStatus = 'error';
        run.state.finalMessage = err.message || 'Error en browser_web';
        this.lastVerification = run.state.finalMessage;
        this.emit('task-failed', { message: run.state.finalMessage, steps: this.currentStep, backend: 'browser_web', error: run.state.finalMessage, taskId: run.artifacts.taskId, reportPath: run.artifacts.reportPath, tracePath: run.artifacts.tracePath, screenshotPath: run.artifacts.finalScreenshotPath });
        throw err;
      } finally {
        await this.finalizeTaskArtifacts({ artifacts: run.artifacts, task, options, startedAt: run.startedAt, finishedAt: new Date().toISOString(), ...run.state });
        resetBrowserTaskRun(this);
      }
    },
    createTaskArtifacts: (task: string) => createBrowserTaskArtifacts(task),
    startTaskTrace() {
      return startBrowserTaskTrace(this.context);
    },
    finalizeTaskArtifacts(params) {
      return finalizeBrowserTaskArtifacts(this, params);
    },
  } satisfies BrowserWebRuntimeApi & ThisType<any>);
}

function prepareBrowserTaskRun(service: any, task: string, options?: BrowserTaskOptions) {
  const maxSteps = options?.maxSteps ?? 40;
  const taskAbort = new AbortController();
  const artifacts = service.createTaskArtifacts(task);
  const state: BrowserTaskMutableState = { history: [], finalSnapshot: null, finalStatus: 'failed', finalMessage: '', traceStarted: false, traceStartError: null };
  Object.assign(service, { abortController: taskAbort, status: 'executing', currentTask: task, currentStep: 0, currentMaxSteps: maxSteps, lastAction: null, lastVerification: null, lastTracePath: null, lastReportPath: artifacts.reportPath, lastScreenshotPath: null });
  service.emit('task-started', { task, maxSteps, backend: 'browser_web', taskId: artifacts.taskId, runDirectory: artifacts.runDirectory });
  return { maxSteps, taskAbort, artifacts, startedAt: new Date().toISOString(), state };
}

function resetBrowserTaskRun(service: any): void {
  service.status = 'idle';
  service.currentTask = null;
  service.currentStep = 0;
  service.currentMaxSteps = 0;
  service.currentUrl = service.page && !service.page.isClosed() ? service.page.url() : null;
  service.abortController = null;
  service.processQueue();
}
