import type { BrowserWebConstructor, BrowserWebLifecycleApi } from './service-types';

export type { BrowserWebLifecycleApi } from './service-types';

export function attachBrowserWebLifecycle(Service: BrowserWebConstructor): void {
  Object.assign(Service.prototype, {
    setApiKey(key: string) {
      this.apiKey = key;
      this.genAI = null;
    },
    getStatus() {
      return {
        status: this.status,
        currentTask: this.currentTask,
        currentStep: this.currentStep,
        maxSteps: this.currentMaxSteps,
        currentUrl: this.currentUrl,
        currentProfileId: this.currentProfileId,
        currentProfileMode: this.currentProfileMode,
        lastAction: this.lastAction,
        lastVerification: this.lastVerification,
        lastTracePath: this.lastTracePath,
        lastReportPath: this.lastReportPath,
        lastScreenshotPath: this.lastScreenshotPath,
        queuedTasks: this.queue.length,
      };
    },
    isRunning() {
      return this.status !== 'idle' || this.queue.length > 0;
    },
    abortAll() {
      this.abortController?.abort();
      while (this.queue.length > 0) {
        this.queue.shift()?.reject(new Error('Tarea web cancelada antes de ejecutarse.'));
      }
    },
    processQueue() {
      if (this.status !== 'idle' || this.queue.length === 0) return;
      const next = this.queue.shift();
      if (!next) return;
      this.executeTaskInternal(next.task, next.options).then(next.resolve).catch(next.reject);
    },
  } satisfies BrowserWebLifecycleApi & ThisType<any>);
}
