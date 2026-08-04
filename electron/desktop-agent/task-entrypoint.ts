import type { BrowserWebService } from '../browser-web-service';
import type { WindowsUIAService } from '../windows-uia-service';
import { assertWindowsUIASupported, detectPlatformCapabilities, type PlatformCapabilities } from '../platform-capabilities';
import type { AgentTask, DesktopAgentConfig } from '../desktop-agent-types';
import type { DesktopTaskExecutionOptions, WindowsUIAFallbackRunResult } from './types';
import type { DesktopTaskQueueItem } from './task-control';
import { buildTaskOutcome, wrapExternalBackendResult, type DesktopTaskOutcome } from './task-outcome';
import {
  appendRealBrowserSessionGuidance,
  executeBrowserBackendTask,
  executeWindowsUIABackendTask,
  requiresRealBrowserSession,
  shouldUseBrowserBackend,
  shouldUseWindowsUIABackend,
} from './routing';

type DesktopTaskEntrypointContext = {
  apiKey: string;
  browserWeb: BrowserWebService;
  windowsUIA: WindowsUIAService;
  platformCapabilities?: PlatformCapabilities;
  config: DesktopAgentConfig;
  activeTasks: Map<string, AgentTask>;
  taskQueue: DesktopTaskQueueItem[];
  emit: (eventName: string, payload?: unknown) => void;
  executeTaskInternal: (task: string, options?: DesktopTaskExecutionOptions) => Promise<DesktopTaskOutcome>;
  runDesktopFallbackFromUIA: (
    task: string,
    options: DesktopTaskExecutionOptions | undefined,
    runResult: WindowsUIAFallbackRunResult,
  ) => Promise<string>;
  /** Cerebro Computer Use para browser (Gemini); null si no aplica -> browser legacy. */
  computerUseBrowserEnabled?: boolean;
  runComputerUseBrowser?: (task: string, options?: DesktopTaskExecutionOptions) => Promise<DesktopTaskOutcome | null>;
  runVisibleBrowserFallback?: (task: string, options?: DesktopTaskExecutionOptions) => Promise<DesktopTaskOutcome>;
};

export async function executeDesktopAgentTaskEntrypoint(
  task: string,
  options: DesktopTaskExecutionOptions | undefined,
  ctx: DesktopTaskEntrypointContext,
): Promise<DesktopTaskOutcome> {
  if (!ctx.apiKey) {
    throw new Error('API key de Gemini no configurada.');
  }
  const startedAt = Date.now();
  if (shouldUseBrowserBackend(task, options, ctx.config.keywordRoutingEnabled)) {
    // Cerebro Computer Use (Gemini) para browser, con fallback al browser legacy.
    if (ctx.computerUseBrowserEnabled && ctx.runComputerUseBrowser) {
      const cuOutcome = await ctx.runComputerUseBrowser(task, options);
      if (cuOutcome) return cuOutcome;
    }
    if (ctx.runVisibleBrowserFallback) return ctx.runVisibleBrowserFallback(task, options);
    return wrapExternalBackendResult(await executeBrowserBackendTask(ctx.browserWeb, task, options), startedAt);
  }
  if (shouldUseWindowsUIABackend(task, options, ctx.config.keywordRoutingEnabled)) {
    assertWindowsUIASupported(ctx.platformCapabilities ?? detectPlatformCapabilities());
    const message = await executeWindowsUIABackendTask({
      windowsUIA: ctx.windowsUIA,
      task,
      options,
      runFallback: (runResult) => ctx.runDesktopFallbackFromUIA(task, options, runResult),
    });
    return wrapExternalBackendResult(message, startedAt);
  }

  // Sesion real: el backend visual maneja el navegador predeterminado del
  // usuario (open_url), donde viven sus logins; se le inyecta ese contexto.
  let effectiveTask = task;
  if (requiresRealBrowserSession(task, options, ctx.config.keywordRoutingEnabled)) {
    effectiveTask = appendRealBrowserSessionGuidance(task);
    ctx.emit('task-real-browser-session', { task });
    console.log('[DesktopAgent] Tarea requiere sesion real del usuario: se usara el navegador predeterminado via backend visual.');
  }

  if (ctx.activeTasks.size >= ctx.config.maxConcurrentAgents) {
    return enqueueDesktopTask(effectiveTask, options, ctx);
  }

  return ctx.executeTaskInternal(effectiveTask, options);
}

/**
 * Encola la tarea con expiracion y cancelacion: una tarea encolada que su
 * llamador abandono NUNCA debe ejecutarse minutos despues a sus espaldas.
 */
function enqueueDesktopTask(
  task: string,
  options: DesktopTaskExecutionOptions | undefined,
  ctx: DesktopTaskEntrypointContext,
): Promise<DesktopTaskOutcome> {
  console.log(
    `[DesktopAgent] Cola: ${ctx.activeTasks.size}/${ctx.config.maxConcurrentAgents} agentes activos. Encolando: "${task}"`,
  );
  return new Promise<DesktopTaskOutcome>((resolve, reject) => {
    const enqueuedAt = Date.now();
    const timeoutMs = options?.queueTimeoutMs ?? ctx.config.queueTimeoutMs;
    let timer: NodeJS.Timeout | null = null;
    let onAbort: (() => void) | null = null;

    const item: DesktopTaskQueueItem = {
      task,
      options,
      enqueuedAt,
      resolve,
      reject,
      onDequeue: () => {
        if (timer) clearTimeout(timer);
        if (onAbort && options?.signal) options.signal.removeEventListener('abort', onAbort);
      },
    };

    const removeFromQueue = (): boolean => {
      const index = ctx.taskQueue.indexOf(item);
      if (index === -1) return false;
      ctx.taskQueue.splice(index, 1);
      item.onDequeue?.();
      return true;
    };

    if (timeoutMs > 0) {
      timer = setTimeout(() => {
        if (!removeFromQueue()) return;
        const waitedSeconds = Math.round((Date.now() - enqueuedAt) / 1000);
        ctx.emit('task-queue-timeout', { task, waitedMs: Date.now() - enqueuedAt });
        console.warn(`[DesktopAgent] Tarea en cola expiro tras ${waitedSeconds}s sin iniciar: "${task}"`);
        resolve(buildTaskOutcome({
          taskId: null,
          estado: 'cola_expirada',
          mensaje: `Tarea en cola expiro tras ${waitedSeconds}s sin iniciar. Habia ${ctx.config.maxConcurrentAgents} agentes ocupados.`,
          startedAt: enqueuedAt,
        }));
      }, timeoutMs);
    }

    if (options?.signal) {
      onAbort = () => {
        if (!removeFromQueue()) return;
        resolve(buildTaskOutcome({
          taskId: null,
          estado: 'cancelada',
          mensaje: 'Tarea cancelada mientras esperaba en cola.',
          startedAt: enqueuedAt,
        }));
      };
      if (options.signal.aborted) {
        item.onDequeue?.();
        resolve(buildTaskOutcome({ taskId: null, estado: 'cancelada', mensaje: 'Tarea cancelada antes de iniciar.', startedAt: enqueuedAt }));
        return;
      }
      options.signal.addEventListener('abort', onAbort, { once: true });
    }

    ctx.taskQueue.push(item);
    ctx.emit('task-queued', { task, queuePosition: ctx.taskQueue.length });
  });
}
