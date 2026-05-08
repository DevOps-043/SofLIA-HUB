import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import {
  RECENT_MESSAGES_LIMIT,
  SEMANTIC_TOP_K,
} from './constants';
import type { MemoryContextApi, MemoryServiceConstructor } from './service-types';
import type { MemoryContext } from './types';

export function attachMemoryContext(Service: MemoryServiceConstructor): void {
  Object.assign(Service.prototype, {
    async assembleContext(sessionKey: string, phoneNumber: string, currentMessage: string): Promise<MemoryContext> {
      const context: MemoryContext = { recentMessages: [], rollingSummary: null, semanticRecall: [], facts: [] };
      if (!this.db) return context;

      const recent = this.getRecentMessages(sessionKey, RECENT_MESSAGES_LIMIT);
      context.recentMessages = recent.map((message: any) => ({
        role: message.role,
        content: message.content,
        timestamp: message.timestamp,
      }));
      context.rollingSummary = this.getLatestSummary(sessionKey);
      if (this.apiKey && currentMessage.trim().length > 10) {
        try {
          const queryEmbedding = await this.embedText(currentMessage);
          if (queryEmbedding) context.semanticRecall = this.semanticSearch(sessionKey, phoneNumber, queryEmbedding, SEMANTIC_TOP_K);
        } catch (err: any) {
          console.warn('[MemoryService] Semantic search failed:', err.message);
        }
      }
      context.facts = this.getFacts(phoneNumber);
      readMarkdownMemory(context);
      return context;
    },
  } satisfies MemoryContextApi & ThisType<any>);
}

function readMarkdownMemory(context: MemoryContext): void {
  try {
    const userData = app.getPath('userData');
    const soulPath = path.join(userData, 'SOUL.md');
    const identityPath = path.join(userData, 'IDENTITY.md');
    if (fs.existsSync(soulPath)) context.soul = fs.readFileSync(soulPath, 'utf8');
    if (fs.existsSync(identityPath)) context.identity = fs.readFileSync(identityPath, 'utf8');
  } catch (err: any) {
    console.warn('[MemoryService] Could not read markdown memory files:', err.message);
  }
}
