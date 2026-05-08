import type { MemoryContext, StoredMessage } from './types';

export type MemoryServiceConstructor = { prototype: any };

export interface MemoryLifecycleApi {
  init(): void;
  setApiKey(key: string): void;
  close(): void;
  getInitError(): string | null;
  saveToken(serviceName: string, token: string): void;
  getToken(serviceName: string): string | null;
  deleteToken(serviceName: string): boolean;
  formatContextForPrompt(ctx: MemoryContext): string;
}

export interface MemoryMessageApi {
  saveMessage(params: { sessionKey: string; phoneNumber: string; groupJid?: string; role: 'user' | 'model'; content: string; mediaType?: string; mediaFilename?: string }): void;
  getRecentMessages(sessionKey: string, limit?: number): StoredMessage[];
  getConversationHistory(sessionKey: string, limit?: number): Array<{ role: string; parts: Array<{ text: string }> }>;
}

export interface MemoryContextApi {
  assembleContext(sessionKey: string, phoneNumber: string, currentMessage: string): Promise<MemoryContext>;
}

export interface MemorySummaryApi {
  getLatestSummary(sessionKey: string): string | null;
  checkSummarizationThreshold(sessionKey: string): void;
  processSummarizeQueueDebounced(): void;
  processSummarizeQueue(): Promise<void>;
  summarizeSession(sessionKey: string): Promise<void>;
  callGeminiSummarize(conversationText: string): Promise<string | null>;
}

export interface MemoryEmbeddingApi {
  embedText(text: string): Promise<number[] | null>;
  semanticSearch(sessionKey: string, phoneNumber: string, queryEmbedding: number[], topK: number): Array<{ text: string; score: number; timestamp: number }>;
  loadChunksFromDB(sessionKey: string, phoneNumber: string): Array<{ id: number; embedding: number[]; startTime: number | null }>;
  embedAndStoreChunks(sessionKey: string, text: string, sourceType: 'conversation' | 'summary' | 'fact', startTime: number, endTime: number): Promise<void>;
  embedConversationChunks(sessionKey: string, messages: Array<{ role: string; content: string; timestamp: number }>): Promise<void>;
  chunkText(text: string): string[];
  searchMemory(sessionKey: string, phoneNumber: string, query: string, maxResults?: number): Promise<Array<{ text: string; score: number; date: string }>>;
}

export interface MemoryFactsApi {
  saveFact(params: { phoneNumber: string | null; category: string; key: string; value: string; context?: string }): { success: boolean; message?: string };
  getFacts(phoneNumber: string): Array<{ key: string; value: string; category: string }>;
  deleteFact(factId: number): boolean;
  updateSoul(content: string): void;
  updateIdentity(content: string): void;
  appendMemoryCard(sessionKey: string, summary: string): void;
}

export interface MemoryMaintenanceApi {
  compactOldData(daysToKeep?: number): Promise<{ deletedMessages: number; deletedChunks: number }>;
  getStats(sessionKey?: string): { messageCount: number; chunkCount: number; factCount: number; summaryCount: number };
  clearSessionContext(sessionKey: string): void;
  getConversationHistorySinceReset(sessionKey: string, limit?: number): Array<{ role: string; parts: Array<{ text: string }> }>;
  migrateOldMemories(): void;
}
