import { formatForWhatsApp } from '../whatsapp-prompts';
import { LOOP_GUARD_REPEAT_THRESHOLD } from './constants';
import type { AgentLoopState } from './agent-loop-types';

export async function handleRepeatedFailure(
  state: AgentLoopState,
  toolNames: string[],
  count: number,
): Promise<{ done: true; text: string } | { done: false }> {
  state.loopGuardInterventions++;
  if (state.loopGuardInterventions >= 2 || count >= LOOP_GUARD_REPEAT_THRESHOLD) {
    return {
      done: true,
      text: formatForWhatsApp(
        'La tarea quedó bloqueada por fallos repetidos. Revisa el resultado de las herramientas antes de continuar.',
        state.isGroup,
      ),
    };
  }
  // Sin `await` esto dejaba una Promise en `state.response` y el loop leia
  // candidatos de un objeto que no era la respuesta.
  state.response = await state.chatSession.sendMessage({
    message: `ALERTA DEL SISTEMA: Repetiste el mismo fallo con ${toolNames.join(', ')}. Cambia de estrategia.`,
  });
  return { done: false };
}

export async function handlePollNoProgress(
  state: AgentLoopState,
  toolNames: string[],
): Promise<{ done: true; text: string } | { done: false }> {
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
  state.response = await state.chatSession.sendMessage({
    message: `ALERTA DEL SISTEMA: Estas haciendo polling sin cambios reales con ${toolNames.join(', ')}. Cambia de estrategia o informa el estado.`,
  });
  return { done: false };
}
