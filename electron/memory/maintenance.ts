type DatabaseLike = {
  prepare: (sql: string) => {
    run: (...args: any[]) => { changes: number };
    get: (...args: any[]) => any;
  };
};

export function compactMemoryData(input: {
  db: DatabaseLike | null;
  daysToKeep: number;
  clearEmbeddingCache: () => void;
}): { deletedMessages: number; deletedChunks: number } {
  if (!input.db) return { deletedMessages: 0, deletedChunks: 0 };
  const cutoff = Date.now() - (input.daysToKeep * 24 * 60 * 60 * 1000);

  try {
    const msgResult = input.db.prepare('DELETE FROM messages WHERE timestamp < ?').run(cutoff);
    const chunkResult = input.db.prepare('DELETE FROM memory_chunks WHERE source_end_time < ?').run(cutoff);
    input.clearEmbeddingCache();
    const result = { deletedMessages: msgResult.changes, deletedChunks: chunkResult.changes };
    console.log(`[MemoryService] Compacted: ${result.deletedMessages} messages, ${result.deletedChunks} chunks older than ${input.daysToKeep} days`);
    return result;
  } catch (err: any) {
    console.error('[MemoryService] compactOldData error:', err.message);
    return { deletedMessages: 0, deletedChunks: 0 };
  }
}

export function getMemoryStats(
  db: DatabaseLike | null,
  sessionKey?: string,
): { messageCount: number; chunkCount: number; factCount: number; summaryCount: number } {
  if (!db) return { messageCount: 0, chunkCount: 0, factCount: 0, summaryCount: 0 };

  try {
    const where = sessionKey ? 'WHERE session_key = ?' : '';
    const params = sessionKey ? [sessionKey] : [];
    const msgCount = db.prepare(`SELECT COUNT(*) as cnt FROM messages ${where}`).get(...params).cnt;
    const chunkCount = db.prepare(`SELECT COUNT(*) as cnt FROM memory_chunks ${where}`).get(...params).cnt;
    const summaryCount = db.prepare(`SELECT COUNT(*) as cnt FROM summaries ${where}`).get(...params).cnt;
    const factCount = db.prepare('SELECT COUNT(*) as cnt FROM facts').get().cnt;
    return { messageCount: msgCount, chunkCount, factCount, summaryCount };
  } catch {
    return { messageCount: 0, chunkCount: 0, factCount: 0, summaryCount: 0 };
  }
}
