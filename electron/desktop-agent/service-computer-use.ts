import { createComputerUseClient, type CuClient } from './gemini-cu/client';
import { createDesktopCuDriver } from './gemini-cu/desktop-driver';
import { createBrowserCuDriver, type PlaywrightPage } from './gemini-cu/browser-driver';
import { runComputerUseLoop, type CuLoopEstado } from './gemini-cu/loop';
import type { CuDriver, CuEnvironment } from './gemini-cu/types';
import { resolveTaskStepBudget } from './task-budget';
import { buildTaskOutcome, type DesktopTaskEstado, type DesktopTaskOutcome } from './task-outcome';
import { ensureBrowserPage } from '../browser-web/service-page';
import type { DesktopAgentConfig } from '../desktop-agent-types';
import type { DesktopTaskExecutionOptions } from './types';

/**
 * Wiring del cerebro Gemini Computer Use como backend. Reutiliza los ejecutores
 * (nut.js del servicio / Playwright de browserWeb), el presupuesto de pasos y el
 * outcome del agente. Si el motor CU no esta disponible devuelve `null` para que
 * el llamador caiga al loop de vision legacy.
 */

function mapEstado(estado: CuLoopEstado): DesktopTaskEstado {
  // 'bloqueada' no existe en el outcome del agente: se reporta como fallida.
  return estado === 'bloqueada' ? 'fallida' : estado;
}

function nuevoCliente(service: any, environment: CuEnvironment): CuClient {
  const config: DesktopAgentConfig = service.config;
  return createComputerUseClient({
    apiKey: service.apiKey,
    model: config.computerUseModel,
    environment,
    enablePromptInjectionDetection: config.computerUsePromptInjectionDetection,
  });
}

export function computerUseDesktopHabilitado(config: DesktopAgentConfig, options?: DesktopTaskExecutionOptions): boolean {
  if (config.computerUseEngine !== 'gemini' || !config.computerUseDesktopEnabled) return false;
  // Respeta un backend explicito distinto de desktop pedido por el llamador.
  return !options?.backend || options.backend === 'desktop';
}

export function computerUseBrowserHabilitado(config: DesktopAgentConfig): boolean {
  return config.computerUseEngine === 'gemini' && config.computerUseBrowserEnabled;
}

/** Ejecuta una tarea desktop con Computer Use. Devuelve null si CU no esta disponible. */
export async function runComputerUseDesktopTask(
  service: any,
  task: string,
  options?: DesktopTaskExecutionOptions,
): Promise<DesktopTaskOutcome | null> {
  const config: DesktopAgentConfig = service.config;
  const client = nuevoCliente(service, 'ENVIRONMENT_DESKTOP');
  if (!client.disponible()) {
    console.warn('[DesktopAgent][CU] Computer Use no disponible (SDK/API key); usando loop legacy.');
    return null;
  }
  const driver = createDesktopCuDriver({
    executeAction: (action) => service.executeAction(action),
    delay: (ms: number) => service.delay(ms),
    takeScreenshot: () => service.takeScreenshot(),
    getScreenshotSize: () => ({
      width: service.lastActualScreenshotWidth || config.screenshotWidth,
      height: service.lastActualScreenshotHeight || config.screenshotHeight,
    }),
  });
  return runCuTaskCommon(service, task, options, client, driver, 'desktop');
}

/** Ejecuta una tarea de navegador con Computer Use sobre la page de browserWeb. */
export async function runComputerUseBrowserTask(
  service: any,
  task: string,
  options?: DesktopTaskExecutionOptions,
): Promise<DesktopTaskOutcome | null> {
  const client = nuevoCliente(service, 'ENVIRONMENT_BROWSER');
  if (!client.disponible()) return null;
  try {
    await ensureBrowserPage(service.browserWeb);
  } catch (error: unknown) {
    console.warn('[DesktopAgent][CU] No se pudo abrir el navegador para Computer Use:', error instanceof Error ? error.message : String(error));
    return null;
  }
  const page = service.browserWeb.page as PlaywrightPage | null;
  if (!page) return null;
  return runCuTaskCommon(service, task, options, client, createBrowserCuDriver(page), 'browser');
}

/** Loop comun: presupuesto, estado, eventos, cancelacion y outcome. */
async function runCuTaskCommon(
  service: any,
  task: string,
  options: DesktopTaskExecutionOptions | undefined,
  client: CuClient,
  driver: CuDriver,
  etiqueta: string,
): Promise<DesktopTaskOutcome> {
  const config: DesktopAgentConfig = service.config;
  const startedAt = Date.now();
  const maxSteps = resolveTaskStepBudget({ requestedMaxSteps: options?.maxSteps, task, config });

  service.status = 'executing';
  service.currentTask = task;
  service.currentStep = 0;
  console.log(`[DesktopAgent][CU] Iniciando tarea (${etiqueta}, ${config.computerUseModel}, ${maxSteps} pasos): "${task.slice(0, 80)}"`);

  const result = await runComputerUseLoop({
    client,
    driver,
    task,
    maxSteps,
    abortSignal: options?.signal ?? null,
    delay: (ms: number) => service.delay(ms),
    onStep: ({ step, nombre, action, intent }) => {
      service.currentStep = step;
      console.log(`[DesktopAgent][CU] Paso ${step}: ${nombre} (${action.tipo}) — ${intent}`);
      service.emit('step', { step, maxSteps, action: { action: action.tipo, message: intent } });
    },
  });

  console.log(`[DesktopAgent][CU] Fin (${etiqueta}): ${result.estado} en ${result.pasos} pasos.`);
  if (result.estado === 'completada') {
    service.emit('task-completed', { task, message: result.mensaje, steps: result.pasos, taskId: null });
  }
  return buildTaskOutcome({
    taskId: null,
    estado: mapEstado(result.estado),
    mensaje: result.mensaje,
    pasosEjecutados: result.pasos,
    startedAt,
  });
}
