import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  EMBEDDING_MODEL,
  EMBEDDING_MODEL_FALLBACK,
  SEMANTIC_TOP_K,
} from './constants';
import { chunkMemoryText } from './chunking';
import { loadMemoryChunksFromDB, searchMemoryEmbeddings } from './embedding-search';
import { embedAndStoreMemoryChunks, embedConversationMemoryChunks } from './embedding-store';
import type { MemoryEmbeddingApi, MemoryServiceConstructor } from './service-types';

export function attachMemoryEmbedding(Service: MemoryServiceConstructor): void {
  Object.assign(Service.prototype, {
    async embedText(text: string) {
      if (!this.apiKey) return null;
      const genAI = new GoogleGenerativeAI(this.apiKey);
      for (const modelName of [EMBEDDING_MODEL, EMBEDDING_MODEL_FALLBACK]) {
        try {
          const model = genAI.getGenerativeModel({ model: modelName });
          const result = await model.embedContent(text);
          return result.embedding.values;
        } catch (err: any) {
          console.warn(`[MemoryService] embedText error with ${modelName}:`, err.message);
        }
      }
      console.error('[MemoryService] All embedding models failed');
      return null;
    },
    semanticSearch(sessionKey: string, phoneNumber: string, queryEmbedding: number[], topK: number) {
      return searchMemoryEmbeddings(this, sessionKey, phoneNumber, queryEmbedding, topK);
    },
    loadChunksFromDB(sessionKey: string, phoneNumber: string) {
      return loadMemoryChunksFromDB(this.db, sessionKey, phoneNumber);
    },
    embedAndStoreChunks(sessionKey: string, text: string, sourceType: 'conversation' | 'summary' | 'fact', startTime: number, endTime: number) {
      return embedAndStoreMemoryChunks(this, sessionKey, text, sourceType, startTime, endTime);
    },
    embedConversationChunks(sessionKey: string, messages: Array<{ role: string; content: string; timestamp: number }>) {
      return embedConversationMemoryChunks(this, sessionKey, messages);
    },
    chunkText(text: string) {
      return chunkMemoryText(text);
    },
    async searchMemory(sessionKey: string, phoneNumber: string, query: string, maxResults = SEMANTIC_TOP_K) {
      if (!this.apiKey) return [];
      try {
        const queryEmbedding = await this.embedText(query);
        if (!queryEmbedding) return [];
        return this.semanticSearch(sessionKey, phoneNumber, queryEmbedding, maxResults).map((result: any) => ({
          text: result.text,
          score: Math.round(result.score * 100) / 100,
          date: result.timestamp ? new Date(result.timestamp).toLocaleDateString('es-MX') : 'desconocida',
        }));
      } catch (err: any) {
        console.error('[MemoryService] searchMemory error:', err.message);
        return [];
      }
    },
  } satisfies MemoryEmbeddingApi & ThisType<any>);
}
