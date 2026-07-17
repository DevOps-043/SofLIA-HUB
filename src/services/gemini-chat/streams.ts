import { extractSources } from './sources';
import type { StreamResult, ToolCallInfo } from './types';

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

export async function buildStreamingResult(result: any, generatedImages: string[]): Promise<StreamResult> {
  const stream = (async function* () {
    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) yield text;
    }
  })();
  const sources = (async () => {
    try {
      return extractSources(await result.response);
    } catch {
      return null;
    }
  })();
  return { stream, sources, generatedImages: generatedImages.length > 0 ? generatedImages : undefined };
}
