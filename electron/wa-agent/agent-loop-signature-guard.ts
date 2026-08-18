import { LOOP_GUARD_CRITICAL_THRESHOLD, LOOP_GUARD_REPEAT_THRESHOLD, POLL_LIKE_TOOLS } from './constants';
import { formatForWhatsApp } from '../whatsapp-prompts';
import type { AgentLoopState } from './agent-loop-types';

export type ToolSignatureGuardResult =
  | { status: 'complete'; text: string }
  | { status: 'retry' }
  | { status: 'continue' };

export async function guardRepeatedToolSignature(
  state: AgentLoopState,
  toolNames: string[],
  toolSignature: string,
): Promise<ToolSignatureGuardResult> {
  const repeatedCallCount = state.toolLoopTrace.filter((entry) => entry.toolSignature === toolSignature).length + 1;
  if (repeatedCallCount < LOOP_GUARD_REPEAT_THRESHOLD) return { status: 'continue' };
  state.loopGuardInterventions++;
  if (repeatedCallCount >= LOOP_GUARD_CRITICAL_THRESHOLD || state.loopGuardInterventions >= 2) {
    return {
      status: 'complete',
      text: formatForWhatsApp(`La tarea entro en un ciclo sin avance. Detecte que ${toolNames.join(', ')} se repite sin progreso.`, state.isGroup),
    };
  }
  state.response = await state.chatSession.sendMessage({ message: `ALERTA DEL SISTEMA: Estas repitiendo exactamente las mismas herramientas (${toolNames.join(', ')}). Cambia de estrategia.` });
  return { status: 'retry' };
}

export function isPollLikeNoProgress(
  state: AgentLoopState,
  signature: string,
  responseSignature: string,
  toolNames: string[],
): boolean {
  const repeated = state.toolLoopTrace.filter((entry) =>
    entry.toolSignature === signature && entry.responseSignature === responseSignature,
  ).length;
  return toolNames.length > 0 && toolNames.every((toolName) => POLL_LIKE_TOOLS.has(toolName)) && repeated >= LOOP_GUARD_REPEAT_THRESHOLD;
}
