import { SEMANTIC_MIN_SCORE } from './constants';
import { cosineSimilarity } from './math';

export function searchMemoryEmbeddings(
  service: any,
  sessionKey: string,
  phoneNumber: string,
  queryEmbedding: number[],
  topK: number,
): Array<{ text: string; score: number; timestamp: number }> {
  if (!service.db) return [];
  try {
    let chunks = service.embeddingCache.get(sessionKey);
    if (!chunks) {
      chunks = service.loadChunksFromDB(sessionKey, phoneNumber);
      service.embeddingCache.set(sessionKey, chunks);
    }
    if (chunks.length === 0) return [];
    const topResults = chunks
      .map((chunk: any) => ({ id: chunk.id, score: cosineSimilarity(queryEmbedding, chunk.embedding), startTime: chunk.startTime }))
      .sort((left: any, right: any) => right.score - left.score)
      .filter((score: any) => score.score >= SEMANTIC_MIN_SCORE)
      .slice(0, topK);
    if (topResults.length === 0) return [];
    return loadTopChunkRows(service.db, topResults);
  } catch (err: any) {
    console.error('[MemoryService] semanticSearch error:', err.message);
    return [];
  }
}

function loadTopChunkRows(db: any, topResults: Array<{ id: number; score: number }>) {
  const ids = topResults.map((result) => result.id);
  const placeholders = ids.map(() => '?').join(',');
  const rows = db.prepare(`SELECT id, chunk_text, source_start_time FROM memory_chunks WHERE id IN (${placeholders})`).all(...ids) as Array<{ id: number; chunk_text: string; source_start_time: number | null }>;
  const rowMap = new Map(rows.map((row) => [row.id, row]));
  return topResults
    .map((result) => {
      const row = rowMap.get(result.id);
      return { text: row?.chunk_text || '', score: result.score, timestamp: row?.source_start_time || 0 };
    })
    .filter((result) => result.text);
}

export function loadMemoryChunksFromDB(
  db: any,
  sessionKey: string,
  phoneNumber: string,
): Array<{ id: number; embedding: number[]; startTime: number | null }> {
  if (!db) return [];
  try {
    const rows = db.prepare(`
      SELECT id, embedding, source_start_time FROM memory_chunks
      WHERE session_key = ? OR phone_number = ?
      ORDER BY source_start_time DESC
      LIMIT 5000
    `).all(sessionKey, phoneNumber) as Array<{ id: number; embedding: string; source_start_time: number | null }>;
    return rows.map((row) => ({ id: row.id, embedding: JSON.parse(row.embedding) as number[], startTime: row.source_start_time }));
  } catch (err: any) {
    console.error('[MemoryService] loadChunksFromDB error:', err.message);
    return [];
  }
}
