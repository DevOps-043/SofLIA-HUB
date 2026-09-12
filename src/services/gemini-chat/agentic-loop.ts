import { sanitizeAssistantText } from './assistant-text-sanitizer';
import { completedStreamResult, isAbortError, singleChunkStream, stoppedStreamResult } from './streams';
import { isMalformedFunctionCall, resolveEmptyGeminiText } from './empty-response';
import { getPublicAiErrorMessage } from './public-error';
import { withAbortSignal, type GeminiChatConfig } from './model-config';
import { withGeminiModelCall, withToolTimeout } from './resilience';
import { executeGeminiToolCall, isKnownGeminiTool } from './tool-dispatch';
import {
  inspectWorkspaceCompletion,
  WORKSPACE_INCOMPLETE_MESSAGE,
  WORKSPACE_REPAIR_INSTRUCTION,
} from './workspace-completion';
import type { SendMessageStreamOptions, StreamResult, ToolCallInfo } from './types';
import { toolBudgetExhaustedMessage } from './tool-budget';

/**
 * Recuperacion ante una llamada de herramienta mal formada, con la misma
 * escalada que ya usaba el agente de WhatsApp (`electron/wa-agent/agent-loop.ts`):
 * primero se pide reemitir la llamada y, si vuelve a fallar, se pide responder
 * SIN herramientas. Insistir una tercera vez no aporta; bajar a texto si deja
 * al usuario con una respuesta util en vez de un callejon sin salida.
 *
 * Ninguna repite la peticion del usuario: la sesion ya la tiene en su
 * historial, y duplicarla haria que el modelo la tratara como otra solicitud.
 */
const MALFORMED_CALL_INSTRUCTIONS = [
  'Tu ultima llamada a una herramienta llego mal formada y no se pudo ejecutar. Vuelve a emitirla ahora con el nombre exacto de la herramienta y sus argumentos en JSON valido, sin texto adicional.',
  'Tu llamada volvio a llegar mal formada. NO uses herramientas en esta respuesta: contesta al usuario con texto, di que no pudiste completar la accion y pide que reformule la solicitud.',
] as const;

export async function runAgenticLoop(params: {
  chatSession: any;
  /** Config de la sesion; se reenvia en cada peticion (no se hereda). */
  chatConfig: GeminiChatConfig;
  messageContent: any;
  options?: SendMessageStreamOptions;
  allToolCalls: ToolCallInfo[];
  allGeneratedImages: string[];
  failFastOnModelError?: boolean;
}): Promise<StreamResult> {
  const signal = params.options?.signal;
  // `abortSignal` viaja DENTRO del config, y el config por peticion no hereda
  // del de la sesion: mandarlo solo con la señal dejaria al turno sin tools ni
  // systemInstruction a media conversacion.
  const requestConfig = withAbortSignal(params.chatConfig, signal);

  if (signal?.aborted) return stoppedStreamResult(params.allToolCalls, params.allGeneratedImages);

  let response: any;
  try {
    response = await withGeminiModelCall(
      'Gemini initial agentic message',
      () => params.chatSession.sendMessage({ message: params.messageContent, config: requestConfig }),
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
  let malformedRetries = 0;

  while (maxIterations > 0) {
    maxIterations -= 1;
    if (signal?.aborted) return stoppedStreamResult(params.allToolCalls, params.allGeneratedImages);
    // `@google/genai` devuelve la respuesta directa, sin envoltorio `{ response }`.
    const parts = response.candidates?.[0]?.content?.parts || [];
    collectInlineImages(parts, params.allGeneratedImages);
    const functionCalls = parts.filter((part: any) => part.functionCall);
    if (functionCalls.length === 0) {
      // El turno acabo sin llamada utilizable porque el modelo la genero mal.
      // Antes esto terminaba el turno y obligaba al usuario a reescribir su
      // peticion; es un fallo transitorio y se reintenta solo.
      if (malformedRetries < MALFORMED_CALL_INSTRUCTIONS.length && isMalformedFunctionCall(response)) {
        const instruccion = MALFORMED_CALL_INSTRUCTIONS[malformedRetries];
        malformedRetries += 1;
        try {
          response = await withGeminiModelCall(
            'Gemini malformed function call retry',
            () => params.chatSession.sendMessage({
              message: [{ text: instruccion }],
              config: requestConfig,
            }),
            { signal },
          );
          continue;
        } catch (error) {
          if (isAbortError(error, signal)) return stoppedStreamResult(params.allToolCalls, params.allGeneratedImages);
          if (params.failFastOnModelError) throw error;
          return safeFailureResult(error, params);
        }
      }
      const completion = await inspectWorkspaceCompletion(params.options?.activeSkill);
      if (completion.required && !completion.ready) {
        try {
          response = await withGeminiModelCall(
            'Gemini incomplete workspace repair',
            () => params.chatSession.sendMessage({
              message: [{ text: `${WORKSPACE_REPAIR_INSTRUCTION}\n\nComprobacion: ${completion.message}` }],
              config: requestConfig,
            }),
            { signal },
          );
          continue;
        } catch (error: any) {
          if (isAbortError(error, signal)) return stoppedStreamResult(params.allToolCalls, params.allGeneratedImages);
          if (params.failFastOnModelError) throw error;
          return safeFailureResult(error, params);
        }
      }
      return finalTextResult(parts, response, params);
    }

    const functionResponses = await executeFunctionCalls(functionCalls, params);
    if (signal?.aborted) return stoppedStreamResult(params.allToolCalls, params.allGeneratedImages);
    if (functionResponses.length === 0) return finalTextResult(parts, response.response, params);
    try {
      response = await withGeminiModelCall(
        'Gemini tool response message',
        // El SDK las empaqueta como `role: "user"`, que es lo que Gemini 3
        // acepta; el SDK legado usaba `role: "function"` y devolvia 400.
        () => params.chatSession.sendMessage({ message: functionResponses as any, config: requestConfig }),
        { signal },
      );
    } catch (error: any) {
      if (isAbortError(error, signal)) return stoppedStreamResult(params.allToolCalls, params.allGeneratedImages);
      if (params.failFastOnModelError) throw error;
      return safeFailureResult(error, params);
    }
  }

  const completion = await inspectWorkspaceCompletion(params.options?.activeSkill);
  const fallbackText = completion.required && !completion.ready
    ? WORKSPACE_INCOMPLETE_MESSAGE
    : toolBudgetExhaustedMessage(params.allToolCalls);
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
  error: unknown,
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
