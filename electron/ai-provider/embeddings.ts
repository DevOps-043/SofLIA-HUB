import { getSessionOpenAIClient } from './session-client';

export const EMBEDDING_MODEL = 'text-embedding-3-small';

export async function embedSessionTexts(texts: string[], dimensions: number, signal?: AbortSignal): Promise<number[][]> {
  if (!texts.length || texts.length > 32 || texts.some(value => !value.trim() || value.length > 16_000)) throw new Error('Entrada de memoria no válida.');
  signal?.throwIfAborted();
  const client = await getSessionOpenAIClient();
  signal?.throwIfAborted();
  const response = await client.embeddings.create({ model: EMBEDDING_MODEL, input: texts, dimensions, encoding_format: 'float' }, { signal });
  signal?.throwIfAborted();
  const ordered = [...response.data].sort((a, b) => a.index - b.index);
  if (ordered.length !== texts.length || ordered.some((entry, index) => entry.index !== index || entry.embedding.length !== dimensions || !entry.embedding.every(Number.isFinite))) throw new Error('Vectores de memoria no válidos.');
  return ordered.map(entry => entry.embedding);
}
