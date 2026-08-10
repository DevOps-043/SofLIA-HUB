import type { ResponseInput } from 'openai/resources/responses/responses';
import type { ReasoningEffort } from 'openai/resources/shared';
import { LONG_RUNNING_TOOL_TIMEOUTS_MS } from '../gemini-chat/agentic-loop';
import { createAssistantTextSanitizer } from '../gemini-chat/assistant-text-sanitizer';
import { buildModelTools } from '../gemini-chat/model-config';
import { getPublicAiErrorMessage } from '../gemini-chat/public-error';
import { isTransientGeminiError, sleepWithSignal, withToolTimeout } from '../gemini-chat/resilience';
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
/**
 * Una Skill con espacio de trabajo entrega varios archivos, no una respuesta:
 * leer la fuente, traer imagenes, escribir el documento, los estilos y el
 * guion, y corregir. Con el tope de 10 el turno se quedaba a medias y el
 * usuario recibia un "he ejecutado las acciones" sobre una carpeta incompleta.
 */
const MAX_TOOL_ITERATIONS_WITH_WORKSPACE = 20;
const MAX_OUTPUT_TOKENS = 16384;
/** Un documento HTML completo no cabe en 16k tokens de salida. */
const MAX_OUTPUT_TOKENS_WITH_WORKSPACE = 32768;
const UNUSABLE_RESPONSE_MESSAGE = 'No obtuve una respuesta utilizable en este turno. Vuelve a intentarlo o reformula la solicitud.';
/**
 * Items de salida que se reinyectan en el siguiente turno del ciclo. Incluye
 * `reasoning` a proposito: sin el, GPT-5.6 pierde el hilo del razonamiento
 * entre una tanda de acciones y la siguiente.
 */
const REPLAYABLE_OUTPUT_TYPES = new Set(['message', 'reasoning', 'function_call', 'web_search_call']);
/**
 * Backoff mas largo que el de Gemini: el limite por minuto se libera al cerrar
 * la ventana de sesenta segundos, y un turno que construye archivos mueve
 * cargas grandes. Un reintento a los 1.2s vuelve a chocar con el mismo muro.
 */
const RATE_LIMIT_BACKOFF_MS = [2_000, 8_000, 20_000, 35_000] as const;
/** Techo de espera por reintento: mas alla, el usuario merece una respuesta. */
const MAX_RETRY_WAIT_MS = 45_000;
/**
 * Presupuesto por peticion. La restriccion real no es el contexto del modelo
 * sino los tokens por minuto de la organizacion: veinte iteraciones a 40 000
 * tokens agotan una cuota de 200 000 aunque ninguna peticion sea desmesurada.
 */
const MAX_REPLAYED_INPUT_TOKENS = 60_000;
/** Resultados recientes que nunca se recortan: son el material de trabajo. */
const KEEP_RECENT_OUTPUTS = 3;
/** Coste aproximado de una captura como imagen, no como su base64. */
const IMAGE_TOKEN_COST = 1_500;
const OMITTED_OUTPUT = '[resultado anterior omitido para que el turno quepa. Vuelve a ejecutar la herramienta si necesitas su contenido]';
/** Umbral a partir del cual una llamada ya ejecutada se considera lastre. */
const MAX_REPLAYED_ARGUMENT_CHARS = 4_000;
const BULKY_ARGUMENT_CHARS = 800;
/** Capturas que siguen describiendo el estado actual de la pantalla. */
const MAX_LIVE_SCREENSHOTS = 3;
const OMITTED_ARGUMENT = '[contenido ya entregado y escrito; omitido del contexto. Vuelve a leer el archivo si lo necesitas]';

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
  const conWorkspace = Boolean(params.options?.activeSkill?.workspaceId);
  const maxIterations = conWorkspace ? MAX_TOOL_ITERATIONS_WITH_WORKSPACE : MAX_TOOL_ITERATIONS;
  const maxOutputTokens = conWorkspace ? MAX_OUTPUT_TOKENS_WITH_WORKSPACE : MAX_OUTPUT_TOKENS;
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
      for (let iteration = 0; iteration < maxIterations; iteration += 1) {
        if (signal?.aborted) return;

        // Lo ya ejecutado se replica en cada peticion. Sin aligerarlo, escribir
        // un documento largo hace que su contenido viaje otra vez en cada
        // iteracion y el turno acaba topando el limite del proveedor.
        if (iteration > 0) compactReplayedCalls(input);

        const outputItems: any[] = [];
        // El limite por minuto NO llega al abrir el stream: llega leyendolo, y
        // por eso un reintento alrededor de la apertura no lo veia nunca. El
        // intento se repite entero —abrir y consumir— pero SOLO mientras no se
        // haya emitido texto: reintentar despues lo duplicaria en pantalla.
        let emitidoEnIntento = false;
        for (let intento = 0; ; intento += 1) {
          outputItems.length = 0;
          emitidoEnIntento = false;
          // El canal visible a veces trae andamiaje interno del modelo (tokens
          // de control y el JSON de la llamada que el proveedor no separo en su
          // propio item). Eso es razonamiento y mecanica, no la respuesta.
          const sanitizer = createAssistantTextSanitizer();
          try {
            const events: any = await client.responses.create(
              {
                model: params.modelId,
                instructions: params.systemInstruction,
                input,
                max_output_tokens: maxOutputTokens,
                stream: true,
                ...(tools.length > 0 ? { tools } : {}),
                ...(tools.length > 0 ? { tool_choice: 'auto' as const } : {}),
                ...(effort ? { reasoning: { effort } } : {}),
              },
              signal ? { signal } : undefined,
            );

            for await (const event of events) {
              if (signal?.aborted) return;
              if (event.type === 'response.output_text.delta' && event.delta) {
                const safeDelta = sanitizer.push(event.delta as string);
                if (safeDelta) {
                  emitidoEnIntento = true;
                  emittedText = true;
                  yield safeDelta;
                }
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
            const safeTail = sanitizer.flush();
            if (safeTail) {
              emitidoEnIntento = true;
              emittedText = true;
              yield safeTail;
            }
            break;
          } catch (error) {
            const espera = retryDelayMs(error, intento);
            if (emitidoEnIntento || espera === null || signal?.aborted || !isTransientGeminiError(error)) throw error;
            console.warn(`[OpenAIChat] limite del proveedor → reintento ${intento + 1} en ${espera}ms`);
            await sleepWithSignal(espera, signal);
          }
        }

        const functionCalls = outputItems.filter((item) => item.type === 'function_call');
        if (functionCalls.length === 0) {
          // Un turno cuyo canal visible solo traia andamiaje se queda sin texto
          // tras el saneado: es preferible decirlo a dejar la burbuja vacia.
          if (!emittedText) yield UNUSABLE_RESPONSE_MESSAGE;
          return;
        }

        // Sin `previous_response_id` el modelo solo ve lo que va en `input`: se
        // reinyecta la salida del turno antes de adjuntar los resultados.
        for (const item of outputItems) {
          if (REPLAYABLE_OUTPUT_TYPES.has(item.type)) input.push(item);
        }

        const ejecutadas = await runFunctionCalls(functionCalls, params, toolCalls, generatedImages, input);
        if (signal?.aborted) return;
        if (ejecutadas === 0) {
          if (!emittedText) yield UNUSABLE_RESPONSE_MESSAGE;
          return;
        }
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

/**
 * Aligera los argumentos de las llamadas ya ejecutadas antes de reenviarlas.
 *
 * El contenido de un archivo que el modelo ya escribio no aporta nada en las
 * iteraciones siguientes —el resultado de la herramienta confirma la escritura
 * y el archivo autoritativo esta en disco—, pero se reenviaba entero en cada
 * peticion. En una presentacion eso multiplica el documento por el numero de
 * iteraciones restantes. Se conserva la llamada y su emparejamiento; solo se
 * sustituyen los valores voluminosos, y el propio marcador le dice al modelo
 * como recuperarlos.
 */
function compactReplayedCalls(input: ResponseInput): void {
  dropStaleScreenshots(input);
  fitInputBudget(input);
  for (const item of input as Array<{ type?: string; arguments?: string }>) {
    if (item?.type !== 'function_call' || typeof item.arguments !== 'string') continue;
    if (item.arguments.length <= MAX_REPLAYED_ARGUMENT_CHARS) continue;

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(item.arguments);
    } catch {
      continue;
    }
    if (!parsed || typeof parsed !== 'object') continue;

    let aligerado = false;
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value !== 'string' || value.length <= BULKY_ARGUMENT_CHARS) continue;
      parsed[key] = OMITTED_ARGUMENT;
      aligerado = true;
    }
    if (aligerado) item.arguments = JSON.stringify(parsed);
  }
}

/**
 * Mantiene la peticion dentro de un presupuesto de tokens descartando los
 * RESULTADOS de herramienta mas antiguos.
 *
 * Este es el gasto que de verdad tumbaba el turno: leer una pagina, descargar
 * un documento y listar carpetas deja varios resultados grandes que se
 * reenvian integros en cada iteracion. Diez iteraciones asi suman los 200 000
 * tokens por minuto de la organizacion aunque ninguna peticion sea enorme por
 * si sola. Se conservan intactos los mas recientes —son el material con el que
 * el modelo esta trabajando ahora— y los anteriores dejan una nota que dice
 * como recuperarlos.
 */
function fitInputBudget(input: ResponseInput): void {
  if (estimateTokens(input) <= MAX_REPLAYED_INPUT_TOKENS) return;

  const salidas = (input as Array<{ type?: string; output?: string }>).filter(
    (item) => item?.type === 'function_call_output' && typeof item.output === 'string',
  );

  for (const salida of salidas.slice(0, Math.max(0, salidas.length - KEEP_RECENT_OUTPUTS))) {
    if (estimateTokens(input) <= MAX_REPLAYED_INPUT_TOKENS) return;
    if ((salida.output?.length ?? 0) <= OMITTED_OUTPUT.length) continue;
    salida.output = OMITTED_OUTPUT;
  }
}

/**
 * Estimacion barata en tokens. Una imagen cuesta un precio fijo por resolucion,
 * no su longitud en base64: medir por caracteres la haria parecer cien veces
 * mas cara de lo que es y recortariamos texto util sin motivo.
 */
function estimateTokens(input: ResponseInput): number {
  let total = 0;
  for (const item of input as unknown as Array<Record<string, unknown>>) {
    if (Array.isArray(item?.content)) {
      for (const parte of item.content as Array<Record<string, unknown>>) {
        total += parte?.type === 'input_image' ? IMAGE_TOKEN_COST : safeLength(parte) / 4;
      }
      continue;
    }
    total += safeLength(item) / 4;
  }
  return Math.round(total);
}

function safeLength(value: unknown): number {
  try {
    return JSON.stringify(value)?.length ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Conserva solo las capturas recientes. Una pantalla de hace ocho acciones ya
 * no describe nada que siga siendo cierto, pero seguiria pagando su costo en
 * cada peticion del turno.
 */
function dropStaleScreenshots(input: ResponseInput): void {
  type Mensaje = { role?: string; content?: unknown };
  const conImagen = (input as Mensaje[]).filter(
    (item) => item?.role === 'user'
      && Array.isArray(item.content)
      && item.content.some((parte: { type?: string }) => parte?.type === 'input_image'),
  );

  for (const mensaje of conImagen.slice(0, Math.max(0, conImagen.length - MAX_LIVE_SCREENSHOTS))) {
    mensaje.content = 'La captura de este paso se descarto por antigua; vuelve a capturar si la necesitas.';
  }
}

/**
 * Cuanto esperar antes de repetir el intento, o `null` si ya no toca.
 *
 * El proveedor suele decir cuanto falta ("Please try again in 1.049s"): esa
 * cifra vale mas que cualquier backoff que inventemos, porque conoce el estado
 * real de su ventana. Se respeta con un margen, sin bajar del backoff propio
 * y con un techo, para no dejar al usuario esperando indefinidamente.
 */
function retryDelayMs(error: unknown, intento: number): number | null {
  if (intento >= RATE_LIMIT_BACKOFF_MS.length) return null;
  const backoff = RATE_LIMIT_BACKOFF_MS[intento];
  const sugerido = parseRetryAfterMs(error);
  if (sugerido === null) return backoff;
  return Math.min(Math.max(sugerido + 250, backoff), MAX_RETRY_WAIT_MS);
}

function parseRetryAfterMs(error: unknown): number | null {
  const mensaje = error instanceof Error ? error.message : String(error ?? '');
  const enMilis = /try again in\s+([\d.]+)\s*ms/i.exec(mensaje);
  if (enMilis) return Math.round(Number(enMilis[1]));
  const enSegundos = /try again in\s+([\d.]+)\s*s/i.exec(mensaje);
  if (enSegundos) return Math.round(Number(enSegundos[1]) * 1_000);
  return null;
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
    if (!isKnownGeminiTool(call.name, params.options?.activeSkill)) continue;
    const args = parseToolArguments(call.arguments);
    let output: unknown;
    let imagenes: string[] = [];
    try {
      const result = await withToolTimeout(
        `Tool call ${call.name}`,
        () => executeGeminiToolCall(call.name, args, params.options, allToolCalls, allGeneratedImages),
        LONG_RUNNING_TOOL_TIMEOUTS_MS[call.name],
      );
      output = result.functionResponse.response;
      imagenes = result.images ?? [];
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
    // La salida de una herramienta solo admite texto. Una captura va aparte,
    // como imagen: incrustarla en base64 dentro del JSON costaba cientos de
    // miles de tokens y la peticion superaba el limite del proveedor.
    if (imagenes.length > 0) {
      input.push({
        role: 'user',
        content: imagenes.map((imageUrl) => ({ type: 'input_image' as const, image_url: imageUrl, detail: 'auto' as const })),
      });
    }
    ejecutadas += 1;
  }
  return ejecutadas;
}

function buildTools(params: OpenAIStreamParams, effort: ReasoningEffort | undefined): any[] {
  // `use_computer` se mantiene: delega la conduccion de la pantalla al actuador
  // Gemini 3.6 Flash del proceso main, que resuelve DPI y multi-monitor.
  const functionTools = params.useToolLoop
    ? toOpenAITools(buildModelTools(params.computerUseEnabled, params.modelId, params.options?.activeSkill))
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
