import { formatForWhatsApp } from '../whatsapp-prompts';
import { LOOP_GUARD_REPEAT_THRESHOLD } from './constants';
import type { AgentLoopState } from './agent-loop-types';

export function handleRepeatedFailure(
  state: AgentLoopState,
  toolNames: string[],
  summary: any[],
  count: number,
): { done: true; text: string } | { done: false } {
  state.loopGuardInterventions++;
  if (state.loopGuardInterventions >= 2 || count >= LOOP_GUARD_REPEAT_THRESHOLD) {
    const lastError = summary.find((item) => typeof item.error === 'string')?.error;
    return {
      done: true,
      text: formatForWhatsApp(
        `La tarea quedo bloqueada por fallos repetidos.${lastError ? ` Ultimo error: ${lastError}` : ''}`,
        state.isGroup,
      ),
    };
  }
  state.response = state.chatSession.sendMessage(
    `ALERTA DEL SISTEMA: Repetiste el mismo fallo con ${toolNames.join(', ')}. Cambia de estrategia.`,
  );
  return { done: false };
}

export function handlePollNoProgress(state: AgentLoopState, toolNames: string[]): { done: true; text: string } | { done: false } {
  state.loopGuardInterventions++;
  if (state.loopGuardInterventions >= 2) {
    return {
      done: true,
      text: formatForWhatsApp(
        'La tarea sigue en espera sin cambios reales. Necesito mas tiempo, otra estrategia o intervencion del usuario.',
        state.isGroup,
      ),
    };
  }
  state.response = state.chatSession.sendMessage(
    `ALERTA DEL SISTEMA: Estas haciendo polling sin cambios reales con ${toolNames.join(', ')}. Cambia de estrategia o informa el estado.`,
  );
  return { done: false };
}
