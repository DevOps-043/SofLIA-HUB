import { completedStreamResult, singleChunkStream } from './streams';
import { withGeminiTimeout, withToolTimeout } from './resilience';
import { executeGeminiToolCall, isKnownGeminiTool } from './tool-dispatch';
import type { SendMessageStreamOptions, StreamResult, ToolCallInfo } from './types';

export async function runAgenticLoop(params: {
  chatSession: any;
  messageContent: any;
  options?: SendMessageStreamOptions;
  allToolCalls: ToolCallInfo[];
  allGeneratedImages: string[];
}): Promise<StreamResult> {
  let response: any;
  try {
    response = await withGeminiTimeout(
      'Gemini initial agentic message',
      () => params.chatSession.sendMessage(params.messageContent),
    );
  } catch (error: any) {
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
        ),
      );
    } catch (error: any) {
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
  const message = error?.message || 'El modelo no respondio a tiempo.';
  return {
    stream: singleChunkStream(`No pude completar la respuesta de forma segura: ${message}`),
    sources: Promise.resolve(null),
    toolCalls: params.allToolCalls.length > 0 ? params.allToolCalls : undefined,
    generatedImages: params.allGeneratedImages.length > 0 ? params.allGeneratedImages : undefined,
  };
}
