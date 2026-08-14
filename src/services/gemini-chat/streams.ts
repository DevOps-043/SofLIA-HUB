import { extractSources } from './sources';
import type { StreamResult, StreamSource, ToolCallInfo } from './types';

/** Texto mostrado cuando el usuario cancela la generación con el botón Stop. */
export const STOP_MESSAGE = '⏹️ Detenido.';

export function singleChunkStream(text: string): AsyncIterable<string> {
  return (async function* () {
    yield text;
  })();
}

/** Acumula un stream de texto en un unico string. */
export async function collectStreamText(stream: AsyncIterable<string>): Promise<string> {
  let text = '';
  for await (const chunk of stream) text += chunk;
  return text;
}

/** ¿El error/estado corresponde a una cancelación del usuario (AbortSignal)? */
export function isAbortError(error: unknown, signal?: AbortSignal): boolean {
  if (signal?.aborted) return true;
  const name = (error as { name?: string } | null)?.name;
  return name === 'AbortError';
}

/**
 * Resultado cuando el usuario detiene la generación: conserva las tool calls e
 * imágenes ya producidas y muestra el texto parcial acumulado (o STOP_MESSAGE).
 */
export function stoppedStreamResult(
  toolCalls: ToolCallInfo[],
  generatedImages: string[],
  partialText?: string,
): StreamResult {
  return {
    stream: singleChunkStream(partialText?.trim() ? partialText : STOP_MESSAGE),
    sources: Promise.resolve(null),
    toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    generatedImages: generatedImages.length > 0 ? generatedImages : undefined,
  };
}

export function completedStreamResult(
  text: string,
  response: any,
  toolCalls: ToolCallInfo[],
  generatedImages: string[],
): StreamResult {
  return {
    stream: singleChunkStream(text),
    sources: Promise.resolve(extractSources(response)),
    toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    generatedImages: generatedImages.length > 0 ? generatedImages : undefined,
  };
}

/**
 * Adapta el stream de `@google/genai` al contrato interno.
 *
 * Dos diferencias con el SDK anterior gobiernan este codigo:
 *
 * 1. `chunk.text` es un descriptor de acceso, no un metodo. Invocarlo como
 *    funcion lanza `TypeError` en tiempo de ejecucion.
 * 2. No existe un `result.response` aparte del stream: los metadatos de
 *    grounding viajan dentro de los propios chunks, asi que las fuentes solo
 *    pueden resolverse cuando el stream termina.
 *
 * De (2) se sigue que la promesa de fuentes debe resolverse tambien cuando el
 * consumidor abandona el stream a medias —el `break` del boton Stop invoca
 * `return()` sobre el generador— o cuando el proveedor falla. Sin eso, un
 * `await result.sources` posterior dejaria el turno colgado para siempre.
 */
export async function buildStreamingResult(
  chunks: AsyncIterable<any>,
  generatedImages: string[],
): Promise<StreamResult> {
  let resolveSources: (sources: StreamSource[] | null) => void = () => undefined;
  const sources = new Promise<StreamSource[] | null>((resolve) => { resolveSources = resolve; });
  let ultimoConFuentes: any = null;

  const stream = (async function* () {
    try {
      for await (const chunk of chunks) {
        if (chunk?.candidates?.length) ultimoConFuentes = chunk;
        const text = readChunkText(chunk);
        if (text) yield text;
      }
    } finally {
      resolveSources(ultimoConFuentes ? extractSources(ultimoConFuentes) : null);
    }
  })();

  return { stream, sources, generatedImages: generatedImages.length > 0 ? generatedImages : undefined };
}

/**
 * Lee el texto del chunk sin invocarlo. Un `text` de tipo funcion solo puede
 * venir del SDK anterior; tratarlo como texto produciria basura en el chat, asi
 * que se descarta.
 */
function readChunkText(chunk: any): string {
  const text = chunk?.text;
  return typeof text === 'string' ? text : '';
}

/** Lee las llamadas a funcion del chunk, que el SDK nuevo expone como propiedad. */
export function readChunkFunctionCalls(chunk: any): any[] {
  const calls = chunk?.functionCalls;
  return Array.isArray(calls) ? calls : [];
}
