import type { StreamSource } from './types';

export function extractSources(response: any): StreamSource[] | null {
  try {
    const sources: StreamSource[] = [];
    const candidate = response.candidates?.[0] as any;
    const metadata = candidate?.groundingMetadata || candidate?.grounding_metadata;
    const groundingChunks = metadata?.groundingChunks || metadata?.grounding_chunks || [];
    if (groundingChunks.length) {
      sources.push(
        ...groundingChunks
          .filter((chunk: any) => chunk.web)
          .map((chunk: any, index: number) => ({
            uri: chunk.web.uri,
            title: chunk.web.title || 'Source',
            snippet: findGroundingSnippet(metadata, index),
          })),
      );
    }
    sources.push(...extractUrlContextSources(response));
    return sources.length > 0 ? dedupeSources(sources) : null;
  } catch {
    return null;
  }
}

function findGroundingSnippet(metadata: any, index: number): string {
  const supports = metadata?.groundingSupports || metadata?.grounding_supports || [];
  const support = (supports as any[]).find((item: any) => {
    const indices = item.groundingChunkIndices || item.grounding_chunk_indices || [];
    return indices.includes(index);
  });
  return support?.segment?.text || '';
}

function extractUrlContextSources(response: any): StreamSource[] {
  const candidate = response.candidates?.[0] as any;
  const metadata = candidate?.urlContextMetadata || candidate?.url_context_metadata;
  const entries = metadata?.urlMetadata || metadata?.url_metadata || [];
  return entries
    .map((entry: any) => ({
      uri: entry.retrievedUrl || entry.retrieved_url || entry.url || entry.uri,
      title: entry.retrievedUrl || entry.retrieved_url || entry.url || entry.uri || 'URL',
      snippet: entry.urlRetrievalStatus || entry.url_retrieval_status || '',
    }))
    .filter((source: StreamSource) => !!source.uri);
}

function dedupeSources(sources: StreamSource[]): StreamSource[] {
  const seen = new Set<string>();
  return sources.filter((source) => {
    if (seen.has(source.uri)) return false;
    seen.add(source.uri);
    return true;
  });
}
