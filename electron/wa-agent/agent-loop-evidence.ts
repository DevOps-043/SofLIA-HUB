import type { AgentLoopState } from './agent-loop-types';
import { getEvidenceModeFromToolCall } from './loop-helpers';

export async function enforceEvidenceOrder(state: AgentLoopState, functionCalls: any[]): Promise<boolean> {
  const modes = functionCalls.map((part) => getEvidenceModeFromToolCall({
    name: part.functionCall?.name,
    args: part.functionCall?.args || {},
  }));
  const remoteOnly = modes.length > 0 && modes.every((mode) => mode === 'remote');
  const hasVisualAttempt = modes.some((mode) => mode === 'local_visual');
  const hasNonVisualAttempt = modes.some((mode) => mode === 'local' || mode === 'remote');
  if (state.requirements.local && !state.evidence.local && remoteOnly) {
    state.response = await state.chatSession.sendMessage({ message: 'ERROR: El usuario pidio validacion local. Primero inspecciona la app o computadora local.' });
    return true;
  }
  if (state.requirements.visual && !state.evidence.visual && !hasVisualAttempt && hasNonVisualAttempt) {
    state.response = await state.chatSession.sendMessage({ message: 'ERROR: El usuario pidio revisar visualmente la app o ventana correcta. Usa use_computer o captura de pantalla.' });
    return true;
  }
  return false;
}

export function updateEvidenceFromToolResult(state: AgentLoopState, part: any, result: any): void {
  if (!part.functionCall?.name || result?.success === false || typeof result?.error === 'string') return;
  const mode = getEvidenceModeFromToolCall({ name: part.functionCall.name, args: part.functionCall.args || {} });
  if (mode === 'local') state.evidence.local = true;
  if (mode === 'local_visual') {
    state.evidence.visual = true;
    state.evidence.local = true;
  }
  if (mode === 'remote') state.evidence.remote = true;
}
