import type { StreamSource } from './types';
import { jsonObject } from '../../shared/grounded-generation';

const records = (value: unknown): Record<string, unknown>[] => Array.isArray(value) ? value.filter(jsonObject) : [];
const text = (value: unknown) => typeof value === 'string' ? value : '';
function publicUri(value: unknown): string {
  if (typeof value !== 'string' || value.length > 8192) return '';
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? value : ''; }
  catch { return ''; }
}
export function extractSources(response: unknown): StreamSource[] | null {
  try {
    if (!jsonObject(response)) return null;
    const candidate = records(response.candidates)[0]; if (!candidate) return null;
    const sources: StreamSource[] = [];
    const metadata = candidate.groundingMetadata ?? candidate.grounding_metadata;
    if (jsonObject(metadata)) {
      const rawChunks = metadata.groundingChunks ?? metadata.grounding_chunks;
      const chunks: unknown[] = Array.isArray(rawChunks) ? rawChunks : [];
      const supports = records(metadata.groundingSupports ?? metadata.grounding_supports);
      chunks.forEach((chunk, index) => {
        if (!jsonObject(chunk) || !jsonObject(chunk.web)) return;
        const uri = publicUri(chunk.web.uri); if (!uri) return;
        const support = supports.find(item => {
          const indices = item.groundingChunkIndices ?? item.grounding_chunk_indices;
          return Array.isArray(indices) && indices.includes(index);
        });
        sources.push({ uri, title: text(chunk.web.title) || 'Fuente', snippet: jsonObject(support?.segment) ? text(support.segment.text) : '' });
      });
    }
    const context = candidate.urlContextMetadata ?? candidate.url_context_metadata;
    if (jsonObject(context)) for (const entry of records(context.urlMetadata ?? context.url_metadata)) {
      const status = text(entry.urlRetrievalStatus ?? entry.url_retrieval_status);
      if (status && status !== 'URL_RETRIEVAL_STATUS_SUCCESS') continue;
      const uri = publicUri(entry.retrievedUrl ?? entry.retrieved_url ?? entry.url ?? entry.uri);
      if (uri) sources.push({ uri, title: uri, snippet: status });
    }
    const seen = new Set<string>();
    const unique = sources.filter(source => { if (seen.has(source.uri)) return false; seen.add(source.uri); return true; });
    return unique.length ? unique : null;
  } catch { return null; }
}
