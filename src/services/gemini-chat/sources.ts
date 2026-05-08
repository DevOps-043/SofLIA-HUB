import type { StreamSource } from './types';

export function extractSources(response: any): StreamSource[] | null {
  try {
    const metadata = response.candidates?.[0]?.groundingMetadata as any;
    if (!metadata?.groundingChunks) return null;
    return metadata.groundingChunks
      .filter((chunk: any) => chunk.web)
      .map((chunk: any, index: number) => ({
        uri: chunk.web.uri,
        title: chunk.web.title || 'Source',
        snippet: findGroundingSnippet(metadata, index),
      }));
  } catch {
    return null;
  }
}

function findGroundingSnippet(metadata: any, index: number): string {
  if (!metadata.groundingSupports) return '';
  const support = (metadata.groundingSupports as any[]).find((item: any) => item.groundingChunkIndices?.includes(index));
  return support?.segment?.text || '';
}
