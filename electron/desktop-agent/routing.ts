import type { DesktopTaskExecutionOptions, WindowsUIAFallbackRunResult } from './types';
import { buildDesktopFallbackTask } from './fallback';
import { describeRealBrowserContext } from '../browser-web/real-browser-profile';

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

/**
 * Frases que indican que la tarea depende de la sesion/contraseñas REALES del
 * usuario. El perfil automatizado de Playwright esta vacio (sin logins), asi
 * que estas tareas deben ir al backend visual sobre el navegador predeterminado.
 */
const REAL_BROWSER_SESSION_PATTERN = /mi cuenta|mis cuentas|mi sesi[oó]n|sesi[oó]n iniciada|sesi[oó]n abierta|ya (estoy|esta) loguead|estoy loguead|ya inici[eé] sesi[oó]n|con mi usuario|mis contrase[ñn]as|contrase[ñn]as? guardadas?|credenciales guardadas|autocompletar|autofill|navegador real|mi navegador|navegador predeterminado|perfil real|mi perfil (de|del) (chrome|edge|brave|navegador)|donde (ya )?estoy conectad/;

/**
 * true si la tarea debe ejecutarse sobre el navegador REAL del usuario
 * (backend visual + open_url) porque necesita sus sesiones o contraseñas.
 * Un backend "browser" explicito del llamador gana sobre la heuristica,
 * pero nunca sobre el flag useRealBrowser.
 */
export function requiresRealBrowserSession(
  task: string,
  options?: DesktopTaskExecutionOptions,
  keywordRoutingEnabled = true,
): boolean {
  if (options?.useRealBrowser) return true;
  if (options?.backend === 'browser' || options?.browserProfile || options?.browserIsolated) return false;
  if (!keywordRoutingEnabled) return false;
  return REAL_BROWSER_SESSION_PATTERN.test(task.toLowerCase());
}

/**
 * Anexa a la tarea el contexto del navegador real (nombre y perfil activo) con
 * instrucciones para que el agente visual use open_url y NO Playwright.
 */
export function appendRealBrowserSessionGuidance(task: string): string {
  return `${task}

[NAVEGADOR REAL] ${describeRealBrowserContext()} Abre los sitios web con la accion open_url (abre el navegador predeterminado con el perfil del usuario) y trabaja sobre esa ventana. NO uses el navegador automatizado: ahi el usuario no tiene sesiones ni contraseñas.`;
}

export function shouldUseBrowserBackend(
  task: string,
  options?: DesktopTaskExecutionOptions,
  keywordRoutingEnabled = true,
): boolean {
  if (options?.useRealBrowser) return false;
  if (options?.backend === 'browser') return true;
  if (options?.backend === 'uia') return false;
  if (options?.backend === 'desktop') return false;
  // Tareas que dependen de la sesion real del usuario nunca van a Playwright.
  if (requiresRealBrowserSession(task, options, keywordRoutingEnabled)) return false;
  // Sin heuristica de palabras clave, la eleccion queda en el backend explicito
  // del llamador o en el backendPreferido del planner estrategico.
  if (!keywordRoutingEnabled) return false;

  const lower = task.toLowerCase();
  return /https?:\/\/|www\.|gmail|google calendar|calendar\.google|mail\.google|drive\.google|docs\.google|sheets\.google|slides\.google|linkedin|notion|salesforce|hubspot|chatgpt|chat gpt|chat\.openai\.com|sitio web|pagina web|pagina de|navegador|browser|chrome|edge|formulario web|portal web/.test(lower);
}

export function shouldUseWindowsUIABackend(
  task: string,
  options?: DesktopTaskExecutionOptions,
  keywordRoutingEnabled = true,
): boolean {
  if (options?.backend === 'uia') return true;
  if (options?.backend === 'browser' || options?.backend === 'desktop') return false;
  // Las tareas con sesion real van al backend visual (navegador real), no a UIA.
  if (requiresRealBrowserSession(task, options, keywordRoutingEnabled)) return false;
  if (!keywordRoutingEnabled) return false;
  if (shouldUseBrowserBackend(task, options, keywordRoutingEnabled)) return false;

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
