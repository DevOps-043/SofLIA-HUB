import { extractSources } from './sources';
import type { StreamResult, ToolCallInfo } from './types';

export function singleChunkStream(text: string): AsyncIterable<string> {
  return (async function* () {
    yield text;
  })();
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
