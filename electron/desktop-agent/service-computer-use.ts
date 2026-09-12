import { createComputerUseClient, type CuClient } from './gemini-cu/client';
import { assertCuNotAborted } from './gemini-cu/execution-guard';
import { beginBrowserCuTask, updateBrowserCuStep } from './browser-cu-task';
import type { BrowserCuSupervisor } from './browser-cu-supervisor';
import { runSupervisedCuLoop } from './gemini-cu/supervised-loop';
import { createDesktopCuDriver } from './gemini-cu/desktop-driver';
import { createBrowserCuDriver, type PlaywrightPage } from './gemini-cu/browser-driver';
import { runComputerUseLoop, type CuLoopEstado } from './gemini-cu/loop';
import { resolveComputerUseModel } from './gemini-cu/model-registry';
import type { CuDriver, CuEnvironment } from './gemini-cu/types';
import { resolveTaskStepBudget } from './task-budget';
import { buildTaskOutcome, type DesktopTaskEstado, type DesktopTaskOutcome } from './task-outcome';
import { ensureBrowserPage } from '../browser-web/service-page';
import { createIntegratedBrowserCuDriver } from '../integrated-browser';
import type { DesktopAgentConfig } from '../desktop-agent-types';
import type { DesktopTaskExecutionOptions } from './types';
import type { DesktopAgentService } from '../desktop-agent-service';

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
  // El ID del modelo se resuelve SIEMPRE por el registro: ningun literal de
  // modelo debe vivir en el wiring.
  const { model } = resolveComputerUseModel(config);
  return createComputerUseClient({
    apiKey: service.apiKey,
    model,
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
  const integrated = service.integratedBrowser && !options?.browserIsolated && !options?.browserProfile && !options?.resetBrowserProfile;
  const startedAt = Date.now();
  const taskControl = beginBrowserCuTask(service, task, resolveTaskStepBudget({
    task, config: service.config, requestedMaxSteps: options?.maxSteps, surface: integrated ? 'integrated-browser' : 'other',
  }), options?.signal);
  try {
    assertCuNotAborted(taskControl.signal);
    return await runBrowserCuWithControl(service, task, { ...options, signal: taskControl.signal }, client, taskControl.taskId, taskControl.supervisor);
  } catch (error) {
    if (!taskControl.signal.aborted) throw error;
    return buildTaskOutcome({ taskId: taskControl.taskId, estado: 'cancelada', mensaje: 'Tarea cancelada.', startedAt });
  } finally {
    taskControl.finish();
  }
}

async function runBrowserCuWithControl(
  service: DesktopAgentService, task: string, options: DesktopTaskExecutionOptions, client: CuClient, taskId: string, supervisor: BrowserCuSupervisor,
): Promise<DesktopTaskOutcome | null> {
  if (service.integratedBrowser && !options?.browserIsolated && !options?.browserProfile && !options?.resetBrowserProfile) {
    const browser = service.integratedBrowser;
    let acquiredControl = false;
    const detach = browser.bindAgentTask(supervisor);
    try {
      await browser.openForAgent(options?.startUrl, undefined, options.signal);
      acquiredControl = true;
      assertCuNotAborted(options.signal);
      return await runCuTaskCommon(
        service,
        task,
        options,
        client,
        createIntegratedBrowserCuDriver(browser),
        'navegador_integrado',
        taskId,
        supervisor,
      );
    } finally {
      detach();
      if (acquiredControl) browser.releaseAgentControl();
    }
  }
  try {
    await ensureBrowserPage(service.browserWeb);
  } catch (error: unknown) {
    assertCuNotAborted(options.signal);
    console.warn('[DesktopAgent][CU] No se pudo abrir el navegador para Computer Use:', error instanceof Error ? error.message : String(error));
    return null;
  }
  assertCuNotAborted(options.signal);
  const page = service.browserWeb.page as PlaywrightPage | null;
  if (!page) return null;
  return runCuTaskCommon(service, task, options, client, createBrowserCuDriver(page), 'browser', taskId);
}

/** Loop comun: presupuesto, estado, eventos, cancelacion y outcome. */
async function runCuTaskCommon(
  service: any,
  task: string,
  options: DesktopTaskExecutionOptions | undefined,
  client: CuClient,
  driver: CuDriver,
  etiqueta: string,
  taskId: string | null = null,
  supervisor?: BrowserCuSupervisor,
): Promise<DesktopTaskOutcome> {
  const config: DesktopAgentConfig = service.config;
  const startedAt = Date.now();
  const integratedBrowserTask = etiqueta === 'navegador_integrado';
  const maxSteps = resolveTaskStepBudget({
    requestedMaxSteps: options?.maxSteps,
    task,
    surface: integratedBrowserTask ? 'integrated-browser' : 'other',
    config,
  });

  // El navegador publica su propio registro; no pisa el estado de una tarea de escritorio.
  if (!taskId) {
    service.status = 'executing';
    service.currentTask = task;
    service.currentStep = 0;
  }
  console.log(`[DesktopAgent][CU] Iniciando tarea (${etiqueta}, ${resolveComputerUseModel(config).model}, ${maxSteps} pasos): "${task.slice(0, 80)}"`);

  try {
    const loopOptions: Parameters<typeof runComputerUseLoop>[0] = {
      client,
      driver,
      task,
      maxSteps,
      abortSignal: options?.signal ?? null,
      delay: (ms: number) => service.delay(ms),
      onStep: ({ step, nombre, action, intent }) => {
        if (taskId) updateBrowserCuStep(service, taskId, step);
        else service.currentStep = step;
        console.log(`[DesktopAgent][CU] Paso ${step}: ${nombre} (${action.tipo}) — ${intent}`);
        service.emit('step', { taskId, step, maxSteps, action: { action: action.tipo, message: intent } });
      },
    };
    const result = supervisor ? await runSupervisedCuLoop(loopOptions, supervisor) : await runComputerUseLoop(loopOptions);

    const resultMessage = result.estado === 'presupuesto_agotado' && integratedBrowserTask
      ? `Se alcanzó el límite de ${maxSteps} pasos sin confirmar la meta. La página, cookies y sesión del navegador integrado permanecen abiertas para continuar desde este punto.`
      : result.mensaje;
    console.log(`[DesktopAgent][CU] Fin (${etiqueta}): ${result.estado} en ${result.pasos} pasos.`);
    if (result.estado === 'completada') {
      service.emit('task-completed', { task, message: resultMessage, steps: result.pasos, taskId });
    } else if (result.estado === 'presupuesto_agotado') {
      service.emit('task-budget-exhausted', { taskId, maxSteps, message: resultMessage });
    }
    return buildTaskOutcome({
      taskId,
      estado: mapEstado(result.estado),
      mensaje: resultMessage,
      pasosEjecutados: result.pasos,
      startedAt,
    });
  } finally {
    if (!taskId && service.currentTask === task) {
      service.status = 'idle';
      service.currentTask = null;
      service.currentStep = 0;
    }
  }
}
