import { getErrorMessage } from '../error-utils';
import { mapCuFunctionCall } from './action-mapping';
import type { CuAction, CuDriver } from './types';
import type { CuClient } from './client';

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
  if (!deps.client.disponible()) {
    return { estado: 'fallida', mensaje: 'Computer Use no disponible (SDK/API key).', pasos: 0 };
  }

  let shot = await deps.driver.capturar();
  let turn = await deps.client.iniciar(deps.task, shot.base64);

  for (let step = 0; step < deps.maxSteps; step++) {
    if (deps.abortSignal?.aborted) return { estado: 'cancelada', mensaje: 'Tarea cancelada.', pasos: step };

    const fc = turn.functionCall;
    if (!fc) {
      // El modelo respondio sin accion: la tarea termino (texto = resultado/fin).
      return { estado: 'completada', mensaje: turn.text || 'Tarea completada.', pasos: step };
    }

    const mapped = mapCuFunctionCall(fc, shot.width, shot.height);
    deps.onStep?.({ step: step + 1, nombre: mapped.nombreOriginal, action: mapped.action, intent: mapped.intent });

    // Seguridad: bloqueo duro o confirmacion HITL antes de ejecutar.
    if (mapped.safety?.decision === 'blocked') {
      return { estado: 'bloqueada', mensaje: `Accion bloqueada por politica de seguridad: ${mapped.safety.explanation ?? ''}`.trim(), pasos: step + 1 };
    }
    let extraResponse: Record<string, unknown> = {};
    if (mapped.safety?.decision === 'require_confirmation') {
      const aprobado = deps.confirmSafety ? await deps.confirmSafety(mapped.safety.explanation ?? '', mapped.action) : false;
      if (!aprobado) {
        return { estado: 'cancelada', mensaje: `Confirmacion requerida NO aprobada: ${mapped.safety.explanation ?? ''}`.trim(), pasos: step + 1 };
      }
      extraResponse.safety_acknowledgement = true;
    }

    // Ejecutar la accion (los errores se reportan al modelo, no rompen el loop).
    try {
      await deps.driver.ejecutar(mapped.action, mapped.intent);
    } catch (error: unknown) {
      extraResponse.error = getErrorMessage(error);
    }

    if (deps.abortSignal?.aborted) return { estado: 'cancelada', mensaje: 'Tarea cancelada.', pasos: step + 1 };

    // Recapturar el nuevo estado y devolverlo como function_response.
    shot = await deps.driver.capturar();
    const contexto = deps.driver.contexto?.() ?? {};
    turn = await deps.client.continuar(fc.id ?? null, fc.name ?? 'action', shot.base64, { ...contexto, ...extraResponse });
  }

  return { estado: 'presupuesto_agotado', mensaje: `Se alcanzo el limite de ${deps.maxSteps} pasos.`, pasos: deps.maxSteps };
}
