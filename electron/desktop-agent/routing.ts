import type { DesktopTaskExecutionOptions, WindowsUIAFallbackRunResult } from './types';
import { buildDesktopFallbackTask } from './fallback';

type BrowserBackend = {
  executeTask(task: string, options?: {
    maxSteps?: number;
    startUrl?: string;
    profileId?: string;
    isolated?: boolean;
    resetProfile?: boolean;
  }): Promise<string>;
};

type WindowsUIARunResult = WindowsUIAFallbackRunResult & {
  status: 'completed' | 'failed' | 'cancelled' | 'error';
  fallbackRecommended: boolean;
};

type WindowsUIABackend = {
  executeTask(task: string, options?: { maxSteps?: number }): Promise<string>;
  getLastRunResult(): WindowsUIARunResult | null;
};

export function shouldUseBrowserBackend(task: string, options?: DesktopTaskExecutionOptions): boolean {
  if (options?.backend === 'browser') return true;
  if (options?.backend === 'uia') return false;
  if (options?.backend === 'desktop') return false;

  const lower = task.toLowerCase();
  return /https?:\/\/|www\.|gmail|google calendar|calendar\.google|mail\.google|drive\.google|docs\.google|sheets\.google|slides\.google|linkedin|notion|salesforce|hubspot|chatgpt|chat gpt|chat\.openai\.com|sitio web|pagina web|pagina de|navegador|browser|chrome|edge|formulario web|portal web/.test(lower);
}

export function shouldUseWindowsUIABackend(task: string, options?: DesktopTaskExecutionOptions): boolean {
  if (options?.backend === 'uia') return true;
  if (options?.backend === 'browser' || options?.backend === 'desktop') return false;
  if (shouldUseBrowserBackend(task, options)) return false;

  const lower = task.toLowerCase();
  return /explorador de archivos|file explorer|explorer|bloc de notas|notepad|calculadora|calculator|paint|word|excel|powerpoint|outlook|configuracion de windows|windows settings|panel de control|control panel|administrador de tareas|task manager|guardar como|save as|abrir archivo|open file|selector de archivos|file picker|dialogo de archivo|file dialog|office|winrar|7-zip|propiedades de carpeta|menu inicio|start menu/.test(lower);
}

export function executeBrowserBackendTask(
  browserWeb: BrowserBackend,
  task: string,
  options?: DesktopTaskExecutionOptions,
): Promise<string> {
  return browserWeb.executeTask(task, {
    maxSteps: options?.maxSteps,
    startUrl: options?.startUrl,
    profileId: options?.browserProfile,
    isolated: options?.browserIsolated,
    resetProfile: options?.resetBrowserProfile,
  });
}

export async function executeWindowsUIABackendTask(input: {
  windowsUIA: WindowsUIABackend;
  task: string;
  options?: DesktopTaskExecutionOptions;
  runFallback: (runResult: WindowsUIAFallbackRunResult) => Promise<string>;
}): Promise<string> {
  const result = await input.windowsUIA.executeTask(input.task, { maxSteps: input.options?.maxSteps });
  const runResult = input.windowsUIA.getLastRunResult();

  if (runResult && runResult.status !== 'completed' && runResult.fallbackRecommended) {
    return input.runFallback({
      message: runResult.message,
      failureCategory: runResult.failureCategory,
      verification: runResult.verification,
      reportPath: runResult.reportPath,
      tracePath: runResult.tracePath,
    });
  }

  return result;
}

export async function runDesktopFallbackFromUIA(input: {
  task: string;
  options: DesktopTaskExecutionOptions | undefined;
  runResult: WindowsUIAFallbackRunResult;
  emit: (eventName: string, payload?: unknown) => void;
  executeDesktopTask: (task: string, options?: DesktopTaskExecutionOptions) => Promise<string>;
}): Promise<string> {
  input.emit('task-fallback', {
    fromBackend: 'windows_uia',
    toBackend: 'desktop_visual',
    reason: input.runResult.message,
    failureCategory: input.runResult.failureCategory,
    reportPath: input.runResult.reportPath || null,
    tracePath: input.runResult.tracePath || null,
  });

  const fallbackTask = buildDesktopFallbackTask(input.task, input.runResult);
  const fallbackResult = await input.executeDesktopTask(fallbackTask, {
    ...input.options,
    backend: 'desktop',
  });
  return `windows_uia fallo y se activo fallback desktop_visual.\nMotivo UIA: ${input.runResult.message}\nResultado fallback: ${fallbackResult}`;
}
