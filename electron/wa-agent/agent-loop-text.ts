import { MAX_HISTORY } from './constants';
import { formatForWhatsApp } from '../whatsapp-prompts';
import { normalizeOutgoingWhatsAppText } from '../whatsapp-text';
import {
  isExecutionDeferralResponse,
  isGenericHelpResponse,
  isGreetingOrHelpRequest,
} from './loop-helpers';
import { resolveWhatsAppOwnerKey } from './whatsapp-owner';
import type { AgentLoopState } from './agent-loop-types';

export async function handleTextOnlyAgentResponse(
  state: AgentLoopState,
  parts: any[],
  finishReason: string | undefined,
  iterations: number,
): Promise<{ done: true; text: string } | { done: false }> {
  const finalText = normalizeOutgoingWhatsAppText(parts.filter((part) => part.text).map((part) => part.text).join('')).trim();
  const missingEvidence = getMissingEvidence(state);
  if (missingEvidence.length > 0) {
    state.response = await state.chatSession.sendMessage({
      message: `ERROR: Aun no reuniste ${missingEvidence.join(' y ')}. Usa herramientas para obtener la evidencia faltante antes de responder.`,
    });
    return { done: false };
  }

  if (await retryActionOrGenericResponse(state, finalText, iterations)) return { done: false };
  persistFinalText(state, finalText);

  if (!finalText && finishReason && finishReason !== 'STOP') {
    return { done: true, text: formatForWhatsApp('Hubo un problema procesando tu solicitud. Intenta reformular tu mensaje.', state.isGroup) };
  }
  if (!finalText && await missingGoogleConnectionResponse(state)) {
    return { done: true, text: formatForWhatsApp('No tengo acceso a tu cuenta de Google. Necesitas conectar Google desde Pulse Hub para usar Drive, Calendar y Gmail.', state.isGroup) };
  }
  const fallback = isGreetingOrHelpRequest(state.userMessage)
    ? '\u00bfEn qu\u00e9 puedo ayudarte?'
    : 'No pude procesar bien tu solicitud. Intenta de nuevo con mas detalle.';
  return { done: true, text: formatForWhatsApp(finalText || fallback, state.isGroup) };
}

function getMissingEvidence(state: AgentLoopState): string[] {
  const missing: string[] = [];
  if (state.requirements.visual && !state.evidence.visual) missing.push('evidencia visual local dentro de la app o ventana correcta');
  if (state.requirements.local && !state.evidence.local) missing.push('evidencia local dentro de la app o computadora');
  if (state.requirements.remote && !state.evidence.remote) missing.push('evidencia remota de web, nube o repositorio');
  return missing;
}

async function retryActionOrGenericResponse(state: AgentLoopState, finalText: string, iterations: number): Promise<boolean> {
  const generic = isGenericHelpResponse(finalText);
  const deferral = isExecutionDeferralResponse(finalText);
  const shouldForceToolRetry = state.isActionRequest && (!finalText || deferral || generic);
  const shouldRetryGenericHelp = generic && !isGreetingOrHelpRequest(state.userMessage);
  if ((shouldForceToolRetry || shouldRetryGenericHelp) && iterations >= 2) return false;
  if (shouldForceToolRetry) {
    state.response = await state.chatSession.sendMessage({
      message: !finalText
        ? 'ERROR: Devolviste una respuesta vacia y no ejecutaste herramientas. Usa function calls ahora.'
        : 'ERROR: No anuncies acciones futuras. Ejecuta herramientas ahora y responde con resultado real.',
    });
    return true;
  }
  if (shouldRetryGenericHelp) {
    state.response = await state.chatSession.sendMessage({
      message: 'ERROR: La ultima respuesta fue generica. Responde directamente a la solicitud actual.',
    });
    return true;
  }
  return false;
}

function persistFinalText(state: AgentLoopState, finalText: string): void {
  state.historyCopy.push({ role: 'user', parts: [{ text: state.userMessage }] });
  state.historyCopy.push({ role: 'model', parts: [{ text: finalText }] });
  const ownerKey = resolveWhatsAppOwnerKey(state.senderNumber, state.isGroup);
  state.agent.memory.saveMessage({
    sessionKey: state.sessionKey,
    phoneNumber: state.senderNumber,
    ownerKey,
    groupJid: state.isGroup ? state.jid : undefined,
    role: 'user',
    content: state.userMessage,
  });
  if (finalText) {
    state.agent.memory.saveMessage({
      sessionKey: state.sessionKey,
      phoneNumber: state.senderNumber,
      ownerKey,
      groupJid: state.isGroup ? state.jid : undefined,
      role: 'model',
      content: finalText,
    });
  }
  while (state.historyCopy.length > MAX_HISTORY * 2) state.historyCopy.shift();
  while (state.historyCopy.length > 0 && state.historyCopy[0].role === 'model') state.historyCopy.shift();
  // Sincronizar de vuelta al Map para que el siguiente mensaje vea el historial actualizado
  state.conversations.set(state.sessionKey, state.historyCopy);
}

async function missingGoogleConnectionResponse(state: AgentLoopState): Promise<boolean> {
  const googleKeywords = /drive|calendar|calendario|agenda|evento|gmail|email|correo/i;
  if (!googleKeywords.test(state.userMessage) || !state.agent.calendarService) return false;
  const connections = state.agent.calendarService.getConnections();
  return !connections.some((connection: any) => connection.provider === 'google' && connection.isActive);
}
