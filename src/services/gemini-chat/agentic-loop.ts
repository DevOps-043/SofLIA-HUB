import { completedStreamResult, singleChunkStream } from './streams';
import { getPublicAiErrorMessage } from './public-error';
import { withGeminiTimeout, withToolTimeout } from './resilience';
import { executeGeminiToolCall, isKnownGeminiTool } from './tool-dispatch';
import type { SendMessageStreamOptions, StreamResult, ToolCallInfo } from './types';

export async function runAgenticLoop(params: {
  chatSession: any;
  messageContent: any;
  options?: SendMessageStreamOptions;
  allToolCalls: ToolCallInfo[];
  allGeneratedImages: string[];
  failFastOnModelError?: boolean;
}): Promise<StreamResult> {
  let response: any;
  try {
    response = await withGeminiTimeout(
      'Gemini initial agentic message',
      () => params.chatSession.sendMessage(params.messageContent),
    );
  } catch (error: any) {
    if (params.failFastOnModelError) throw error;
    return safeFailureResult(error, params);
  }
  let maxIterations = 10;

  while (maxIterations > 0) {
    maxIterations -= 1;
    const parts = response.response.candidates?.[0]?.content?.parts || [];
    const functionCalls = parts.filter((part: any) => part.functionCall);
    if (functionCalls.length === 0) return finalTextResult(parts, response.response, params);

    const functionResponses = await executeFunctionCalls(functionCalls, params);
    if (functionResponses.length === 0) return finalTextResult(parts, response.response, params);
    try {
      response = await withGeminiTimeout(
        'Gemini tool response message',
        () => params.chatSession.sendMessage(functionResponses as any),
      );
    } catch (error: any) {
      if (params.failFastOnModelError) throw error;
      return safeFailureResult(error, params);
    }
  }

  const fallbackText = 'He ejecutado las acciones solicitadas. Si necesitas algo mas, no dudes en pedirlo.';
  return {
    stream: singleChunkStream(fallbackText),
    sources: Promise.resolve(null),
    toolCalls: params.allToolCalls,
    generatedImages: params.allGeneratedImages.length > 0 ? params.allGeneratedImages : undefined,
  };
}

/**
 * Presupuesto de tiempo por herramienta: las tareas de computer use tardan
 * MINUTOS (planeacion + varios pasos de vision). Con el timeout generico de
 * 30s el chat "abandonaba" la llamada (que seguia corriendo en el main),
 * reintentaba con otra use_computer y terminaba con agentes duplicados.
 */
const LONG_RUNNING_TOOL_TIMEOUTS_MS: Record<string, number> = {
  use_computer: 15 * 60_000,
  use_computer_on_node: 15 * 60_000,
};

async function executeFunctionCalls(
  functionCalls: any[],
  params: {
    options?: SendMessageStreamOptions;
    allToolCalls: ToolCallInfo[];
    allGeneratedImages: string[];
  },
): Promise<Array<{ functionResponse: { name: string; response: any } }>> {
  const responses: Array<{ functionResponse: { name: string; response: any } }> = [];
  for (const part of functionCalls) {
    const fc = (part as any).functionCall;
    if (!isKnownGeminiTool(fc.name)) continue;
    try {
      responses.push(
        await withToolTimeout(
          `Tool call ${fc.name}`,
          () => executeGeminiToolCall(fc.name, fc.args || {}, params.options, params.allToolCalls, params.allGeneratedImages),
          LONG_RUNNING_TOOL_TIMEOUTS_MS[fc.name],
        ),
      );
    } catch (error: any) {
      // Si use_computer expiro, abortar la tarea en el main para no dejar un
      // agente zombi ejecutando acciones a espaldas del usuario.
      if (fc.name === 'use_computer' && error?.name === 'TimeoutError') {
        try { await (window as any).desktopAgent?.abort?.(); } catch { /* mejor esfuerzo */ }
      }
      const errorResult = { success: false, error: error.message || 'Timeout ejecutando herramienta.' };
      params.allToolCalls.push({ name: fc.name, args: fc.args || {}, result: JSON.stringify(errorResult) });
      responses.push({ functionResponse: { name: fc.name, response: errorResult } });
    }
  }
  return responses;
}

function finalTextResult(
  parts: any[],
  response: any,
  params: { allToolCalls: ToolCallInfo[]; allGeneratedImages: string[] },
): StreamResult {
  const fullText = parts.filter((part: any) => part.text).map((part: any) => part.text).join('');
  return completedStreamResult(fullText, response, params.allToolCalls, params.allGeneratedImages);
}

function safeFailureResult(
  error: any,
  params: { allToolCalls: ToolCallInfo[]; allGeneratedImages: string[] },
): StreamResult {
  console.warn('[GeminiChat] agentic loop failed:', error);
  const message = getPublicAiErrorMessage(error);
  return {
    stream: singleChunkStream(message),
    sources: Promise.resolve(null),
    toolCalls: params.allToolCalls.length > 0 ? params.allToolCalls : undefined,
    generatedImages: params.allGeneratedImages.length > 0 ? params.allGeneratedImages : undefined,
  };
}
