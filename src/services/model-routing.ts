import { MODELS, OPENAI_MODELS } from '../config';
import type { SendMessageStreamOptions } from './gemini-chat/types';
import { hasSofliaMaxQuota, SOFLIA_MAX_MODEL_ID } from './model-quota';

export interface RoutedModel {
  modelId: string;
  /** El turno gasta una unidad de la cuota mensual de SofLIA Max. */
  consumesSofliaMaxQuota?: boolean;
  /** Se pidio SofLIA Max sin cuota disponible y se degrado a SofLIA Pro. */
  quotaExhausted?: boolean;
}

/**
 * Decide con que modelo se atiende el turno.
 *
 * El modelo visible siempre orquesta el turno. Si necesita Computer Use, la
 * herramienta delega la percepcion y la actuacion al Gemini 3.6 Flash fijo de
 * main sin reemplazar este proveedor conversacional.
 */
export function resolveRoutedModel(params: {
  options?: SendMessageStreamOptions;
  /** @deprecated Computer Use elige su modelo dentro del actuador de main. */
  isComputerActionTurn?: boolean;
  /** @deprecated Las herramientas ya no sustituyen el proveedor conversacional. */
  isCommandTurn?: boolean;
}): RoutedModel {
  const selected = params.options?.model?.trim();
  const userId = params.options?.userId;

  // Elegir SofLIA Max manualmente conserva su cuota de producto.
  if (selected === SOFLIA_MAX_MODEL_ID) {
    if (hasSofliaMaxQuota(userId)) return { modelId: SOFLIA_MAX_MODEL_ID, consumesSofliaMaxQuota: true };
    return { modelId: OPENAI_MODELS.COMMANDS, quotaExhausted: true };
  }

  // La eleccion visible manda tambien en turnos con herramientas. El actuador
  // Computer Use resuelve su modelo fijo dentro del proceso main.
  return { modelId: selected || MODELS.PRIMARY };
}
