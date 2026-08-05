import type { ResponseInput } from 'openai/resources/responses/responses';
import type { ReasoningEffort } from 'openai/resources/shared';
import { LONG_RUNNING_TOOL_TIMEOUTS_MS } from '../gemini-chat/agentic-loop';
import { buildModelTools } from '../gemini-chat/model-config';
import { getPublicAiErrorMessage } from '../gemini-chat/public-error';
import { withToolTimeout } from '../gemini-chat/resilience';
import { isAbortError, STOP_MESSAGE } from '../gemini-chat/streams';
import { executeGeminiToolCall, isKnownGeminiTool } from '../gemini-chat/tool-dispatch';
import type {
  ConversationMessage,
  SendMessageStreamOptions,
  StreamResult,
  ToolCallInfo,
} from '../gemini-chat/types';
import { SOFLIA_MAX_MODEL_ID, recordSofliaMaxTokens } from '../model-quota';
import { getOpenAI } from './client';
import { buildHostedTools } from './hosted-tools';
import { buildOpenAIHistory, buildUserMessage } from './input-builder';
import { resolveOpenAIReasoningEffort } from './reasoning';
import { toOpenAITools } from './tool-schema';

const MAX_TOOL_ITERATIONS = 10;
const MAX_OUTPUT_TOKENS = 16384;
/**
 * Items de salida que se reinyectan en el siguiente turno del ciclo. Incluye
 * `reasoning` a proposito: sin el, GPT-5.6 pierde el hilo del razonamiento
 * entre una tanda de acciones y la siguiente.
 */
const REPLAYABLE_OUTPUT_TYPES = new Set(['message', 'reasoning', 'function_call', 'web_search_call']);

export interface OpenAIStreamParams {
  modelId: string;
  /** Mensaje ya compuesto con el contexto del turno. */
  finalMessage: string;
  systemInstruction: string;
  conversationHistory: ConversationMessage[];
  options?: SendMessageStreamOptions;
  useToolLoop: boolean;
  computerUseEnabled: boolean;
  useWebSearch: boolean;
  /** Esfuerzo de razonamiento forzado por una politica explicita del turno. */
  reasoningEffort?: string;
  /** Aviso que se emite antes de la respuesta (p. ej. cuota agotada). */
  prefixNotice?: string;
}

/**
 * Camino de GPT-5.6 (SofLIA Max / SofLIA Pro). Devuelve el mismo `StreamResult`
 * que el pipeline de Gemini para que el chat, la orbe y el procesador de
 * mensajes no tengan que distinguir de que proveedor viene la respuesta.
 *
 * El texto se emite token a token: el generador conduce todo el ciclo (llamada
 * -> herramientas/acciones -> nueva llamada) de forma perezosa, asi la orbe
 * puede hablar la primera frase sin esperar a que termine la generacion.
 */
export async function sendOpenAIMessageStream(params: OpenAIStreamParams): Promise<StreamResult> {
  const client = await getOpenAI();
  const { options } = params;
  const signal = options?.signal;
  const effort = resolveOpenAIReasoningEffort({
    forced: params.reasoningEffort,
    selected: params.options?.thinking?.level,
  });

  const toolCalls: ToolCallInfo[] = [];
  const generatedImages: string[] = [];
  const sources: Array<{ uri: string; title: string }> = [];
  let resolveSources: (value: Array<{ uri: string; title: string }> | null) => void = () => {};
  const sourcesPromise = new Promise<Array<{ uri: string; title: string }> | null>((resolve) => {
    resolveSources = resolve;
  });

  const tools = buildTools(params, effort);
  const input: ResponseInput = [
    ...buildOpenAIHistory(params.conversationHistory),
    buildUserMessage(params.finalMessage, options?.images),
  ];

  const stream = (async function* (): AsyncIterable<string> {
    let emittedText = false;
    if (params.prefixNotice) {
      emittedText = true;
      yield `${params.prefixNotice}\n\n`;
    }
    try {
      for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration += 1) {
        if (signal?.aborted) return;

        const events: any = await client.responses.create(
          {
            model: params.modelId,
            instructions: params.systemInstruction,
            input,
            max_output_tokens: MAX_OUTPUT_TOKENS,
            stream: true,
            ...(tools.length > 0 ? { tools } : {}),
            ...(tools.length > 0 ? { tool_choice: 'auto' as const } : {}),
            ...(effort ? { reasoning: { effort } } : {}),
          },
          signal ? { signal } : undefined,
        );

        const outputItems: any[] = [];
        for await (const event of events) {
          if (signal?.aborted) return;
          if (event.type === 'response.output_text.delta' && event.delta) {
            emittedText = true;
            yield event.delta as string;
            continue;
          }
          if (event.type === 'response.output_item.done' && event.item) {
            outputItems.push(event.item);
            continue;
          }
          if (event.type === 'response.output_text.annotation.added') {
            collectCitation(event.annotation, sources);
            continue;
          }
          if (event.type === 'response.completed') {
            noteTokenUsage(params, event.response?.usage?.total_tokens);
          }
        }

        const functionCalls = outputItems.filter((item) => item.type === 'function_call');
        if (functionCalls.length === 0) return;

        // Sin `previous_response_id` el modelo solo ve lo que va en `input`: se
        // reinyecta la salida del turno antes de adjuntar los resultados.
        for (const item of outputItems) {
          if (REPLAYABLE_OUTPUT_TYPES.has(item.type)) input.push(item);
        }

        const ejecutadas = await runFunctionCalls(functionCalls, params, toolCalls, generatedImages, input);
        if (signal?.aborted) return;
        if (ejecutadas === 0) return;
      }

      if (!emittedText) yield 'He ejecutado las acciones solicitadas. Si necesitas algo mas, no dudes en pedirlo.';
    } catch (error) {
      if (isAbortError(error, signal)) {
        if (!emittedText) yield STOP_MESSAGE;
        return;
      }
      console.warn('[OpenAIChat] stream failed:', { modelId: params.modelId, error });
      // Sin texto emitido, dejar que el llamador muestre su mensaje de error;
      // con texto ya en pantalla, reemplazarlo lo borraria: se anexa el aviso.
      if (!emittedText) throw error;
      yield `\n\n${getPublicAiErrorMessage(error)}`;
    } finally {
      resolveSources(sources.length > 0 ? sources : null);
    }
  })();

  return { stream, sources: sourcesPromise, toolCalls, generatedImages };
}

/** Ejecuta las funciones locales del turno y adjunta sus resultados. */
async function runFunctionCalls(
  calls: any[],
  params: OpenAIStreamParams,
  allToolCalls: ToolCallInfo[],
  allGeneratedImages: string[],
  input: ResponseInput,
): Promise<number> {
  let ejecutadas = 0;
  for (const call of calls) {
    if (!isKnownGeminiTool(call.name)) continue;
    const args = parseToolArguments(call.arguments);
    let output: unknown;
    try {
      const result = await withToolTimeout(
        `Tool call ${call.name}`,
        () => executeGeminiToolCall(call.name, args, params.options, allToolCalls, allGeneratedImages),
        LONG_RUNNING_TOOL_TIMEOUTS_MS[call.name],
      );
      output = result.functionResponse.response;
    } catch (error: any) {
      // Mismo criterio que el loop de Gemini: si use_computer expiro, abortar
      // el agente en el main para no dejarlo actuando a espaldas del usuario.
      if (call.name === 'use_computer' && error?.name === 'TimeoutError') {
        try { await (window as any).desktopAgent?.abort?.(); } catch { /* mejor esfuerzo */ }
      }
      output = { success: false, error: error?.message || 'Timeout ejecutando herramienta.' };
      allToolCalls.push({ name: call.name, args, result: JSON.stringify(output) });
    }
    input.push({ type: 'function_call_output', call_id: call.call_id, output: JSON.stringify(output) });
    ejecutadas += 1;
  }
  return ejecutadas;
}

function buildTools(params: OpenAIStreamParams, effort: ReasoningEffort | undefined): any[] {
  // `use_computer` se mantiene: delega la conduccion de la pantalla al actuador
  // Gemini 3.6 Flash del proceso main, que resuelve DPI y multi-monitor.
  const functionTools = params.useToolLoop
    ? toOpenAITools(buildModelTools(params.computerUseEnabled, params.modelId))
    : [];

  return [
    ...functionTools,
    ...buildHostedTools({
      useWebSearch: params.useWebSearch,
      reasoningEffort: effort,
    }),
  ];
}

/** El gasto de SofLIA Max se acumula para dar contexto al limite mensual. */
function noteTokenUsage(params: OpenAIStreamParams, totalTokens: unknown): void {
  if (params.modelId !== SOFLIA_MAX_MODEL_ID || typeof totalTokens !== 'number') return;
  recordSofliaMaxTokens(params.options?.userId, totalTokens);
}

function parseToolArguments(raw: unknown): Record<string, any> {
  if (typeof raw !== 'string' || raw.trim() === '') return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function collectCitation(annotation: any, sources: Array<{ uri: string; title: string }>): void {
  if (annotation?.type !== 'url_citation' || !annotation.url) return;
  if (sources.some((source) => source.uri === annotation.url)) return;
  sources.push({ uri: annotation.url, title: annotation.title || annotation.url });
}
