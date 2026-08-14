import { sanitizeAssistantText } from './assistant-text-sanitizer';
import { completedStreamResult, isAbortError, singleChunkStream, stoppedStreamResult } from './streams';
import { resolveEmptyGeminiText } from './empty-response';
import { getPublicAiErrorMessage } from './public-error';
import { withGeminiModelCall, withToolTimeout } from './resilience';
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
  const signal = params.options?.signal;
  // La cancelacion viaja en `config.abortSignal` de la sesion, que `@google/genai`
  // propaga a la peticion HTTP de cada envio.

  if (signal?.aborted) return stoppedStreamResult(params.allToolCalls, params.allGeneratedImages);

  let response: any;
  try {
    response = await withGeminiModelCall(
      'Gemini initial agentic message',
      () => params.chatSession.sendMessage({ message: params.messageContent }),
      { signal },
    );
  } catch (error: any) {
    if (isAbortError(error, signal)) return stoppedStreamResult(params.allToolCalls, params.allGeneratedImages);
    if (params.failFastOnModelError) throw error;
    return safeFailureResult(error, params);
  }
  // Una Skill con espacio de trabajo entrega varios archivos, no una respuesta:
  // con el tope de 10 el turno se quedaba a medias sobre una carpeta a medio
  // escribir y respondia como si hubiera terminado.
  let maxIterations = params.options?.activeSkill?.workspaceId ? 20 : 10;

  while (maxIterations > 0) {
    maxIterations -= 1;
    if (signal?.aborted) return stoppedStreamResult(params.allToolCalls, params.allGeneratedImages);
    // `@google/genai` devuelve la respuesta directamente; el SDK anterior la
    // envolvia en `.response`.
    const parts = response.candidates?.[0]?.content?.parts || [];
    collectInlineImages(parts, params.allGeneratedImages);
    const functionCalls = parts.filter((part: any) => part.functionCall);
    if (functionCalls.length === 0) return finalTextResult(parts, response, params);

    const functionResponses = await executeFunctionCalls(functionCalls, params);
    if (signal?.aborted) return stoppedStreamResult(params.allToolCalls, params.allGeneratedImages);
    if (functionResponses.length === 0) return finalTextResult(parts, response, params);
    try {
      response = await withGeminiModelCall(
        'Gemini tool response message',
        () => params.chatSession.sendMessage({ message: functionResponses }),
        { signal },
      );
    } catch (error: any) {
      if (isAbortError(error, signal)) return stoppedStreamResult(params.allToolCalls, params.allGeneratedImages);
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
export const LONG_RUNNING_TOOL_TIMEOUTS_MS: Record<string, number> = {
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
): Promise<any[]> {
  const responses: any[] = [];
  for (const part of functionCalls) {
    const fc = (part as any).functionCall;
    // El catalogo del turno incluye las herramientas de la Skill activa; sin
    // Skill, la comprobacion es la del catalogo base de siempre.
    if (!isKnownGeminiTool(fc.name, params.options?.activeSkill)) continue;
    try {
      const ejecutada = await withToolTimeout(
        `Tool call ${fc.name}`,
        () => executeGeminiToolCall(fc.name, fc.args || {}, params.options, params.allToolCalls, params.allGeneratedImages),
        LONG_RUNNING_TOOL_TIMEOUTS_MS[fc.name],
      );
      responses.push({ functionResponse: ejecutada.functionResponse });
      // La captura viaja como IMAGEN, no dentro del JSON: en base64 dentro del
      // texto costaba cientos de miles de tokens y tumbaba el turno.
      for (const dataUrl of ejecutada.images ?? []) {
        const inline = toInlineData(dataUrl);
        if (inline) responses.push(inline);
      }
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

/** Convierte una data URL en la parte `inlineData` que espera el SDK. */
function toInlineData(dataUrl: string): { inlineData: { mimeType: string; data: string } } | null {
  const separador = dataUrl.indexOf(',');
  if (!dataUrl.startsWith('data:') || separador === -1) return null;
  const mimeType = dataUrl.slice(5, dataUrl.indexOf(';'));
  const data = dataUrl.slice(separador + 1);
  return mimeType && data ? { inlineData: { mimeType, data } } : null;
}

/**
 * Graficas de code execution (matplotlib) llegan como partes inlineData en
 * cualquier iteracion del loop; se acumulan para mostrarlas en el mensaje.
 */
function collectInlineImages(parts: any[], allGeneratedImages: string[]) {
  for (const part of parts) {
    const data = part?.inlineData || part?.inline_data;
    const mimeType = String(data?.mimeType || data?.mime_type || '');
    if (!data?.data || !mimeType.startsWith('image/')) continue;
    const dataUrl = `data:${mimeType};base64,${data.data}`;
    if (!allGeneratedImages.includes(dataUrl)) allGeneratedImages.push(dataUrl);
  }
}

function finalTextResult(
  parts: any[],
  response: any,
  params: { allToolCalls: ToolCallInfo[]; allGeneratedImages: string[] },
): StreamResult {
  const fullText = sanitizeAssistantText(
    parts.filter((part: any) => part.text).map((part: any) => part.text).join(''),
  );
  return completedStreamResult(
    resolveEmptyGeminiText(fullText, response, params.allGeneratedImages),
    response,
    params.allToolCalls,
    params.allGeneratedImages,
  );
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
