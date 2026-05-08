import { formatForWhatsApp } from '../whatsapp-prompts';
import { createAgentLoopState } from './agent-loop-setup';
import { handleTextOnlyAgentResponse } from './agent-loop-text';
import { handleToolCallAgentResponse } from './agent-loop-tools';
import type { AgentLoopRequest } from './agent-loop-types';

const MAX_ITERATIONS = 25;

export async function runWhatsAppAgentLoop(request: AgentLoopRequest): Promise<string> {
  const stateOrBlock = await createAgentLoopState(request);
  if (typeof stateOrBlock === 'string') return stateOrBlock;
  const state = stateOrBlock;

  for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration++) {
    const candidate = state.response.response.candidates?.[0];
    const finishReason = candidate?.finishReason;
    const parts = candidate?.content?.parts || [];
    const functionCalls = parts.filter((part: any) => part.functionCall);

    if (!candidate || parts.length === 0) {
      console.warn(`[WhatsApp Agent] Empty response from model. finishReason: ${finishReason}`);
      const feedback = (state.response.response as any).promptFeedback;
      if (feedback) console.warn('[WhatsApp Agent] Prompt feedback:', JSON.stringify(feedback));
    }

    if (finishReason === 'MALFORMED_FUNCTION_CALL') {
      const done = await retryMalformedFunctionCall(state, iteration);
      if (done) return done;
      continue;
    }

    if (functionCalls.length === 0) {
      const result = await handleTextOnlyAgentResponse(state, parts, finishReason, iteration);
      if (result.done) return result.text;
      continue;
    }

    const result = await handleToolCallAgentResponse(state, functionCalls);
    if (result.done) return result.text;
  }

  return 'He completado las acciones solicitadas.';
}

async function retryMalformedFunctionCall(state: any, iteration: number): Promise<string | null> {
  console.warn(`[WhatsApp Agent] MALFORMED_FUNCTION_CALL detected (iteration ${iteration}).`);
  if (iteration >= 3) {
    try {
      state.response = await state.chatSession.sendMessage(
        'Tu ultima llamada a funcion fue malformada. NO uses herramientas en esta respuesta. Responde al usuario con texto y pide que repita la solicitud.',
      );
      return null;
    } catch (error: any) {
      console.error('[WhatsApp Agent] Text-only fallback failed:', error.message);
      return formatForWhatsApp('Hubo un problema tecnico. Intenta de nuevo con un mensaje mas corto o especifico.', state.isGroup);
    }
  }
  try {
    state.response = await state.chatSession.sendMessage(
      'ERROR: Tu llamada a funcion fue malformada. Intenta de nuevo usando el nombre exacto de la herramienta y parametros validos.',
    );
    return null;
  } catch (error: any) {
    console.error('[WhatsApp Agent] Retry after MALFORMED_FUNCTION_CALL failed:', error.message);
    return formatForWhatsApp('Hubo un problema tecnico procesando tu solicitud. Intenta de nuevo.', state.isGroup);
  }
}
