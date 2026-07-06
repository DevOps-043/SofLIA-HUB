import { registerBackendEventForwarding } from './backend-event-forwarding';
import { resolveLegacyDesktopStatus } from './legacy-status';
import { executeParallelDesktopTasks } from './parallel-task-runner';
import {
  getDesktopTaskResult,
  processDesktopTaskQueue,
} from './task-control';
import { executeDesktopAgentTaskEntrypoint } from './task-entrypoint';
import { runDesktopAgentTaskInternal } from './task-execution-runtime';
import { runDesktopFallbackFromUIA as runUIAFallback } from './routing';
import {
  computerUseBrowserHabilitado,
  computerUseDesktopHabilitado,
  runComputerUseBrowserTask,
  runComputerUseDesktopTask,
} from './service-computer-use';
import type { AgentStatus, AgentTask } from '../desktop-agent-types';
import type { DesktopAgentService } from '../desktop-agent-service';
import type { DesktopTaskOutcome } from './task-outcome';
import type { DesktopTaskExecutionOptions, WindowsUIAFallbackRunResult } from './types';
import type { DesktopAgentServiceConstructor } from './service-types';

export interface DesktopAgentTaskApi {
  processQueue(): void;
  executeParallelTasks(tasks: Array<{ task: string; maxSteps?: number; backend?: 'auto' | 'browser' | 'desktop' | 'uia'; startUrl?: string; browserProfile?: string; browserIsolated?: boolean; resetBrowserProfile?: boolean }>): Promise<Array<{ task: string; result: string; success: boolean }>>;
  getActiveTasks(): AgentTask[];
  getTaskResult(taskId: string): { status: AgentStatus; result?: string; error?: string } | null;
  restoreLegacyStatusAfterExternalBackendEvent(): void;
  registerExternalBackendEventForwarding(source: import('node:events').EventEmitter): void;
  executeTask(task: string, options?: DesktopTaskExecutionOptions): Promise<string>;
  executeTaskDetailed(task: string, options?: DesktopTaskExecutionOptions): Promise<DesktopTaskOutcome>;
  executeTaskInternal(task: string, options?: DesktopTaskExecutionOptions): Promise<DesktopTaskOutcome>;
  runDesktopFallbackFromUIA(task: string, options: DesktopTaskExecutionOptions | undefined, runResult: WindowsUIAFallbackRunResult): Promise<string>;
}

export function attachDesktopAgentTasks(Service: DesktopAgentServiceConstructor): void {
  Object.assign(Service.prototype, {
    processQueue() {
      processDesktopTaskQueue({
        queue: this.taskQueue,
        activeTasks: this.activeTasks,
        maxConcurrentAgents: this.config.maxConcurrentAgents,
        executeTask: (task, options) => this.executeTaskInternal(task, options),
      });
    },
    executeParallelTasks(tasks) {
      if (!this.apiKey) throw new Error('API key de Gemini no configurada.');
      return executeParallelDesktopTasks(tasks, (task, options) => this.executeTask(task, options));
    },
    getActiveTasks() {
      return Array.from(this.activeTasks.values());
    },
    getTaskResult(taskId) {
      return getDesktopTaskResult(this.activeTasks, taskId);
    },
    restoreLegacyStatusAfterExternalBackendEvent() {
      const nextStatus = resolveLegacyDesktopStatus({
        browserStatus: this.browserWeb.getStatus(),
        windowsUIAStatus: this.windowsUIA.getStatus(),
        activeTasks: this.activeTasks.values(),
        observationRunning: this.observationRunning,
      });
      this.status = nextStatus.status;
      this.currentTask = nextStatus.currentTask;
      this.currentStep = nextStatus.currentStep;
    },
    registerExternalBackendEventForwarding(source) {
      registerBackendEventForwarding({
        source,
        emit: (eventName, payload) => { this.emit(eventName, payload); },
        markTaskStarted: (payload) => {
          this.status = 'executing';
          this.currentTask = payload.task || this.currentTask;
          this.currentStep = 0;
        },
        markStep: (payload) => { this.currentStep = payload.step || this.currentStep; },
        restoreLegacyStatus: () => this.restoreLegacyStatusAfterExternalBackendEvent(),
      });
    },
    async executeTask(task, options) {
      // Fachada legacy: mismos strings que antes; los llamadores nuevos deben
      // usar executeTaskDetailed para distinguir el estado real.
      const outcome = await this.executeTaskDetailed(task, options);
      return outcome.mensaje;
    },
    executeTaskDetailed(task, options) {
      return executeDesktopAgentTaskEntrypoint(task, options, {
        apiKey: this.apiKey,
        browserWeb: this.browserWeb,
        windowsUIA: this.windowsUIA,
        platformCapabilities: this.platformCapabilities,
        config: this.config,
        activeTasks: this.activeTasks,
        taskQueue: this.taskQueue,
        emit: (eventName, payload) => { this.emit(eventName, payload); },
        executeTaskInternal: (nextTask, nextOptions) => this.executeTaskInternal(nextTask, nextOptions),
        runDesktopFallbackFromUIA: (fallbackTask, fallbackOptions, runResult) =>
          this.runDesktopFallbackFromUIA(fallbackTask, fallbackOptions, runResult),
        computerUseBrowserEnabled: computerUseBrowserHabilitado(this.config),
        runComputerUseBrowser: (cuTask, cuOptions) => runComputerUseBrowserTask(this, cuTask, cuOptions),
      });
    },
    async executeTaskInternal(task, options) {
      // Cerebro Computer Use (Gemini) para desktop, con fallback al loop legacy.
      if (computerUseDesktopHabilitado(this.config, options)) {
        const cuOutcome = await runComputerUseDesktopTask(this, task, options);
        if (cuOutcome) return cuOutcome;
      }
      return runDesktopAgentTaskInternal(this, task, options);
    },
    runDesktopFallbackFromUIA(task, options, runResult) {
      return runUIAFallback({
        task,
        options,
        runResult,
        emit: (eventName: string, payload?: unknown) => { this.emit(eventName, payload); },
        executeDesktopTask: (fallbackTask, fallbackOptions) => this.executeTask(fallbackTask, fallbackOptions),
      });
    },
  } satisfies DesktopAgentTaskApi & ThisType<DesktopAgentService>);
}
