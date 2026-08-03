export async function embedAndStoreMemoryChunks(
  service: any,
  sessionKey: string,
  text: string,
  sourceType: 'conversation' | 'summary' | 'fact',
  startTime: number,
  endTime: number,
): Promise<void> {
  if (!service.db || !service.apiKey) return;

  const chunks = service.chunkText(text);
  const phoneNumber = sessionKey.includes(':') ? sessionKey.split(':').pop()! : sessionKey;
  for (const chunk of chunks) {
    try {
      const embedding = await service.embedText(chunk);
      if (!embedding) continue;
      service.db.prepare(`
        INSERT INTO memory_chunks (session_key, phone_number, chunk_text, embedding, source_type, source_start_time, source_end_time)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(sessionKey, phoneNumber, chunk, JSON.stringify(embedding), sourceType, startTime, endTime);
    } catch (err: any) {
      console.error('[MemoryService] embedAndStoreChunks error:', err.message);
    }
  }
  service.embeddingCache.delete(sessionKey);
}

export async function embedConversationMemoryChunks(
  service: any,
  sessionKey: string,
  messages: Array<{ role: string; content: string; timestamp: number }>,
): Promise<void> {
  const text = messages.map((message) => {
    const date = new Date(message.timestamp).toLocaleDateString('es-MX');
    return `[${date}] ${message.role === 'user' ? 'Usuario' : 'Pulse'}: ${message.content}`;
  }).join('\n');
  const startTime = messages[0]?.timestamp || Date.now();
  const endTime = messages[messages.length - 1]?.timestamp || Date.now();
  await service.embedAndStoreChunks(sessionKey, text, 'conversation', startTime, endTime);
}
