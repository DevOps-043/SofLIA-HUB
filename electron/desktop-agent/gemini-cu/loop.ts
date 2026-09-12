import { getErrorMessage } from '../error-utils';
import { mapCuFunctionCall } from './action-mapping';
import type { CuAction, CuDriver } from './types';
import type { CuClient } from './client';
import { assertCuNotAborted, CuContextChangedError } from './execution-guard';
import { waitForCuResponse } from './cancellable-wait';

/**
 * Loop del agente Computer Use, AGNOSTICO del entorno: conversa con la tool
 * `computer_use` (client) y ejecuta cada accion con un `driver` (desktop nut.js
 * o browser Playwright). Maneja presupuesto, cancelacion, seguridad (HITL) y
 * termina cuando el modelo responde sin accion (texto = fin/respuesta).
 */

export type CuLoopEstado = 'completada' | 'fallida' | 'cancelada' | 'presupuesto_agotado' | 'bloqueada';

export type CuLoopResult = { estado: CuLoopEstado; mensaje: string; pasos: number };

export type CuLoopDeps = {
  client: CuClient;
  driver: CuDriver;
  task: string;
  maxSteps: number;
  abortSignal?: AbortSignal | null;
  delay: (ms: number) => Promise<void>;
  /** HITL: ante require_confirmation, devuelve true si el usuario aprueba. */
  confirmSafety?: (explanation: string, action: CuAction) => Promise<boolean>;
  /** Notificacion por paso (para logs/eventos de UI). */
  onStep?: (info: { step: number; nombre: string; action: CuAction; intent: string }) => void;
};

export async function runComputerUseLoop(deps: CuLoopDeps): Promise<CuLoopResult> {
  let steps = 0;
  const signal = deps.abortSignal ?? undefined;
  try {
    assertCuNotAborted(signal);
    return await runLoop(deps, signal, (step) => { steps = step; });
  } catch (error) {
    if (signal?.aborted) return { estado: 'cancelada', mensaje: 'Tarea cancelada.', pasos: steps };
    if (error instanceof CuContextChangedError) return { estado: 'bloqueada', mensaje: error.message, pasos: steps };
    throw error;
  }
}

async function runLoop(deps: CuLoopDeps, signal: AbortSignal | undefined, recordStep: (step: number) => void): Promise<CuLoopResult> {
  if (!deps.client.disponible()) {
    return { estado: 'fallida', mensaje: 'Computer Use no disponible (SDK/API key).', pasos: 0 };
  }

  let shot = await deps.driver.capturar(signal);
  assertCuNotAborted(signal);
  deps.driver.contexto?.();
  let turn = await waitForCuResponse(() => deps.client.iniciar(deps.task, shot.base64, shot.context, signal), signal);

  for (let step = 0; step < deps.maxSteps; step++) {
    if (deps.abortSignal?.aborted) return { estado: 'cancelada', mensaje: 'Tarea cancelada.', pasos: step };
    deps.driver.contexto?.();

    const fc = turn.functionCall;
    if (!fc) {
      // El modelo respondio sin accion: la tarea termino (texto = resultado/fin).
      return { estado: 'completada', mensaje: turn.text || 'Tarea completada.', pasos: step };
    }

    const mapped = mapCuFunctionCall(fc, shot.width, shot.height);
    recordStep(step + 1);
    deps.onStep?.({ step: step + 1, nombre: mapped.nombreOriginal, action: mapped.action, intent: mapped.intent });
    assertCuNotAborted(signal);

    // Seguridad: bloqueo duro o confirmacion HITL antes de ejecutar.
    if (mapped.safety?.decision === 'blocked') {
      return { estado: 'bloqueada', mensaje: `Accion bloqueada por politica de seguridad: ${mapped.safety.explanation ?? ''}`.trim(), pasos: step + 1 };
    }
    let extraResponse: Record<string, unknown> = {};
    if (mapped.safety?.decision === 'require_confirmation') {
      const confirm = deps.confirmSafety;
      const aprobado = confirm ? await waitForCuResponse(() => confirm(mapped.safety?.explanation ?? '', mapped.action), signal) : false;
      if (!aprobado) {
        return { estado: 'cancelada', mensaje: `Confirmacion requerida NO aprobada: ${mapped.safety.explanation ?? ''}`.trim(), pasos: step + 1 };
      }
      extraResponse.safety_acknowledgement = true;
    }

    // Ejecutar la accion (los errores se reportan al modelo, no rompen el loop).
    try {
      assertCuNotAborted(signal);
      await deps.driver.ejecutar(mapped.action, mapped.intent, signal);
    } catch (error: unknown) {
      if (error instanceof CuContextChangedError || signal?.aborted) throw error;
      extraResponse.error = getErrorMessage(error);
    }

    if (deps.abortSignal?.aborted) return { estado: 'cancelada', mensaje: 'Tarea cancelada.', pasos: step + 1 };

    // Recapturar el nuevo estado y devolverlo como function_response.
    shot = await deps.driver.capturar(signal);
    assertCuNotAborted(signal);
    const contexto = { ...(shot.context ?? {}), ...(deps.driver.contexto?.() ?? {}) };
    turn = await waitForCuResponse(() => deps.client.continuar(fc.id ?? null, fc.name ?? 'action', shot.base64, { ...contexto, ...extraResponse }, signal), signal);
    assertCuNotAborted(signal);
  }

  return { estado: 'presupuesto_agotado', mensaje: `Se alcanzo el limite de ${deps.maxSteps} pasos.`, pasos: deps.maxSteps };
}
