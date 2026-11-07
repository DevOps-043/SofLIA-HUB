import { captureSessionOperation } from '../ai-provider/session-operation';
import { EMBEDDING_MODEL } from '../ai-provider/embeddings';
export async function embedAndStoreMemoryChunks(
  service: any,
  sessionKey: string,
  text: string,
  sourceType: 'conversation' | 'summary' | 'fact',
  startTime: number,
  endTime: number,
): Promise<void> {
  if (!service.db) return;

  const operation = captureSessionOperation();
  try {
    const chunks = service.chunkText(text);
    const phoneNumber = sessionKey.includes(':') ? sessionKey.split(':').pop()! : sessionKey;
    for (const chunk of chunks) {
      operation.assert();
      const embedding = await service.embedText(chunk, operation.signal);
      operation.assert();
      if (!embedding) continue;
      service.db.prepare(`
        INSERT INTO memory_chunks (session_key, phone_number, chunk_text, embedding, source_type, source_start_time, source_end_time)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(sessionKey, phoneNumber, chunk, JSON.stringify({ model: EMBEDDING_MODEL, vector: embedding }), sourceType, startTime, endTime);
    }
  } finally {
    operation.dispose();
    service.embeddingCache.delete(sessionKey);
  }
}

export async function embedConversationMemoryChunks(
  service: any,
  sessionKey: string,
  messages: Array<{ role: string; content: string; timestamp: number }>,
): Promise<void> {
  const text = messages.map((message) => {
    const date = new Date(message.timestamp).toLocaleDateString('es-MX');
    return `[${date}] ${message.role === 'user' ? 'Usuario' : 'SofLIA'}: ${message.content}`;
  }).join('\n');
  const startTime = messages[0]?.timestamp || Date.now();
  const endTime = messages[messages.length - 1]?.timestamp || Date.now();
  await service.embedAndStoreChunks(sessionKey, text, 'conversation', startTime, endTime);
}
