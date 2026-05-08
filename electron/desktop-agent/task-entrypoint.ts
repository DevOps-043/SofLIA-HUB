import type { BrowserWebService } from '../browser-web-service';
import type { WindowsUIAService } from '../windows-uia-service';
import type { AgentTask, DesktopAgentConfig } from '../desktop-agent-types';
import type { DesktopTaskExecutionOptions, WindowsUIAFallbackRunResult } from './types';
import type { DesktopTaskQueueItem } from './task-control';
import {
  executeBrowserBackendTask,
  executeWindowsUIABackendTask,
  shouldUseBrowserBackend,
  shouldUseWindowsUIABackend,
} from './routing';

type DesktopTaskEntrypointContext = {
  apiKey: string;
  browserWeb: BrowserWebService;
  windowsUIA: WindowsUIAService;
  config: DesktopAgentConfig;
  activeTasks: Map<string, AgentTask>;
  taskQueue: DesktopTaskQueueItem[];
  emit: (eventName: string, payload?: unknown) => void;
  executeTaskInternal: (task: string, options?: DesktopTaskExecutionOptions) => Promise<string>;
  runDesktopFallbackFromUIA: (
    task: string,
    options: DesktopTaskExecutionOptions | undefined,
    runResult: WindowsUIAFallbackRunResult,
  ) => Promise<string>;
};

export function executeDesktopAgentTaskEntrypoint(
  task: string,
  options: DesktopTaskExecutionOptions | undefined,
  ctx: DesktopTaskEntrypointContext,
): Promise<string> {
  if (!ctx.apiKey) {
    throw new Error('API key de Gemini no configurada.');
  }
  if (shouldUseBrowserBackend(task, options)) {
    return executeBrowserBackendTask(ctx.browserWeb, task, options);
  }
  if (shouldUseWindowsUIABackend(task, options)) {
    return executeWindowsUIABackendTask({
      windowsUIA: ctx.windowsUIA,
      task,
      options,
      runFallback: (runResult) => ctx.runDesktopFallbackFromUIA(task, options, runResult),
    });
  }

  if (ctx.activeTasks.size >= ctx.config.maxConcurrentAgents) {
    console.log(
      `[DesktopAgent] Cola: ${ctx.activeTasks.size}/${ctx.config.maxConcurrentAgents} agentes activos. Encolando: "${task}"`,
    );
    return new Promise<string>((resolve, reject) => {
      ctx.taskQueue.push({ task, options, resolve, reject });
      ctx.emit('task-queued', { task, queuePosition: ctx.taskQueue.length });
    });
  }

  return ctx.executeTaskInternal(task, options);
}
