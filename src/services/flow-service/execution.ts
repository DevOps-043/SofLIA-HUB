import { executeComputerTool } from '../computer-use-service';
import {
  buildDesktopAutomationExecutionPlan,
  buildFocusedBrowserTask,
  buildFocusedDesktopTask,
  openApplicationSilently,
} from './desktop-automation-plan';
import { asString } from './normalizers';
import type { FlowAction, FlowExecutionResult } from './types';

function parseExecutionResult(rawResult: string): FlowExecutionResult {
  try {
    const parsed = JSON.parse(rawResult) as Record<string, any>;
    const success = Boolean(parsed.success);
    const message = asString(parsed.message) || (success ? 'Accion completada.' : 'No pude completar la accion.');
    return { success, message, detail: asString(parsed.error) || undefined, raw: parsed };
  } catch {
    return { success: false, message: 'La accion devolvio una respuesta no valida.', raw: rawResult };
  }
}

function resolveDesktopFallbackTask(actionTask: string, target: string, error: string): string {
  return `${actionTask}

Contexto adicional:
- El intento automatico de abrir ${target} fallo con este detalle: ${error}
- Evita la barra de tareas y el menu Inicio; prioriza enfocarte en una ventana existente si ya esta abierta.`;
}

async function executeDesktopAutomation(action: FlowAction): Promise<FlowExecutionResult> {
  if (!action.task) {
    return { success: false, message: 'Falta la tarea para el agente de escritorio.' };
  }
  if (!window.desktopAgent) {
    return { success: false, message: 'Desktop Agent no esta disponible en esta ventana.' };
  }

  const executionPlan = buildDesktopAutomationExecutionPlan(action.task);
  let taskToRun = executionPlan.task;
  let backend = executionPlan.backend;
  let startUrl = executionPlan.startUrl;

  if (executionPlan.preOpenTarget) {
    const preOpenResult = await openApplicationSilently(executionPlan.preOpenTarget);
    if (preOpenResult.success) {
      taskToRun = buildFocusedDesktopTask(action.task, executionPlan.preOpenTarget);
      backend = 'desktop';
      startUrl = undefined;
    } else if (executionPlan.startUrl) {
      taskToRun = buildFocusedBrowserTask(action.task, executionPlan.startUrl);
      backend = 'browser';
      startUrl = executionPlan.startUrl;
    } else if (preOpenResult.error) {
      taskToRun = resolveDesktopFallbackTask(action.task, executionPlan.preOpenTarget, preOpenResult.error);
    }
  }

  const result = await window.desktopAgent.executeTask(taskToRun, { maxSteps: 80, backend, startUrl });
  return {
    success: Boolean(result?.success),
    message: asString(result?.message) || (result?.success ? 'Automatizacion iniciada.' : 'No pude iniciar la automatizacion.'),
    detail: asString(result?.error) || undefined,
    raw: result,
  };
}

export async function executeFlowAction(action: FlowAction): Promise<FlowExecutionResult> {
  switch (action.type) {
    case 'open_application':
      return action.target
        ? parseExecutionResult(await executeComputerTool('open_application', { path: action.target }))
        : { success: false, message: 'Falta el nombre o ruta de la aplicacion.' };
    case 'open_url':
      return action.url
        ? parseExecutionResult(await executeComputerTool('open_url', { url: action.url }))
        : { success: false, message: 'Falta la URL a abrir.' };
    case 'send_email':
      if (!action.to || !action.body) {
        return { success: false, message: 'Faltan los datos minimos del correo.' };
      }
      return parseExecutionResult(await executeComputerTool('send_email', {
        to: action.to,
        subject: action.subject || 'Mensaje desde voz',
        body: action.body,
        attachment_paths: action.attachmentPaths || [],
        is_html: false,
      }));
    case 'desktop_automation':
      return executeDesktopAutomation(action);
    case 'send_to_chat':
      return { success: true, message: 'Solicitud lista para enviarse al chat.' };
    default:
      return { success: false, message: 'No hay una accion ejecutable asociada.' };
  }
}
