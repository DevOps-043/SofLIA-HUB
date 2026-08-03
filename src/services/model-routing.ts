import { isOpenAIConfigured, MODELS, OPENAI_MODELS } from '../config';
import { isOpenAIModel } from '../shared/model-providers';
import type { SendMessageStreamOptions } from './gemini-chat/types';
import { hasPulseMaxQuota, PULSE_MAX_MODEL_ID } from './model-quota';

/**
 * Esfuerzo de razonamiento forzado en acciones reales sobre la computadora.
 * 'high' es el maximo que expone el selector de la app ("Alto"); abrir una app
 * o mover el cursor sin equivocarse necesita esa potencia.
 */
export const COMPUTER_ACTION_REASONING_EFFORT = 'high';

export interface RoutedModel {
  modelId: string;
  /** Sobrescribe el esfuerzo elegido por el usuario para este turno. */
  reasoningEffort?: string;
  /** El turno gasta una unidad de la cuota mensual de Pulse Max. */
  consumesPulseMaxQuota?: boolean;
  /** Se pidio Pulse Max sin cuota disponible y se degrado a Pulse Pro. */
  quotaExhausted?: boolean;
}

/**
 * Decide con que modelo se atiende el turno.
 *
 * Politica del producto:
 * - Accion real sobre la computadora (abrir app, clic, mover cursor) -> Pulse
 *   Max (GPT-5.6 Terra) con maximo razonamiento.
 * - Orbe y demas comandos con herramientas -> Pulse Pro (GPT-5.6 Luna), que es
 *   la mayoria del uso.
 * - Chat normal -> el modelo que el usuario eligio en el selector.
 *
 * La cuota de 3/mes aplica SOLO cuando el usuario elige Pulse Max a mano en el
 * selector. El ruteo interno a Terra para ejecutar acciones no la consume: si
 * lo hiciera, la orbe dejaria de poder actuar tras la tercera orden del mes.
 *
 * Todo el ruteo a OpenAI depende de que haya llave; sin ella se mantiene el
 * comportamiento con Gemini para no dejar el producto sin respuesta.
 */
export function resolveRoutedModel(params: {
  options?: SendMessageStreamOptions;
  isComputerActionTurn: boolean;
  isCommandTurn: boolean;
}): RoutedModel {
  const selected = params.options?.model?.trim();
  const userId = params.options?.userId;

  // Eleccion explicita de Pulse Max: es el unico camino sujeto a cuota.
  if (selected === PULSE_MAX_MODEL_ID && isOpenAIConfigured()) {
    if (hasPulseMaxQuota(userId)) return { modelId: PULSE_MAX_MODEL_ID, consumesPulseMaxQuota: true };
    return { modelId: OPENAI_MODELS.COMMANDS, quotaExhausted: true };
  }

  // Cualquier otro modelo GPT elegido a mano manda sobre el ruteo automatico.
  if (selected && isOpenAIModel(selected)) return { modelId: selected };

  if (isOpenAIConfigured()) {
    if (params.isComputerActionTurn) {
      return { modelId: OPENAI_MODELS.COMPUTER_USE, reasoningEffort: COMPUTER_ACTION_REASONING_EFFORT };
    }
    if (params.isCommandTurn || params.options?.task === 'orb') {
      return { modelId: OPENAI_MODELS.COMMANDS };
    }
  }

  return { modelId: selected || MODELS.PRIMARY };
}
