/**
 * MemoryService — Infinite context memory for SofLIA WhatsApp agent.
 *
 * 3-layer architecture:
 *  Layer 1: Raw message persistence (SQLite)
 *  Layer 2: Rolling conversation summaries (Gemini + SQLite)
 *  Layer 3: Semantic search via embeddings (Gemini text-embedding-004 + cosine similarity)
 *  Bonus:   Structured facts (replaces whatsapp-memories.json)
 *
 * Runs in the Electron main process.
 */
import { EventEmitter } from 'node:events';
import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import Database from 'better-sqlite3';
import { GoogleGenerativeAI } from '@google/generative-ai';

// ─── Constants ───────────────────────────────────────────────────────
const DB_PATH = path.join(app.getPath('userData'), 'soflia-memory.db');
const OLD_MEMORIES_PATH = path.join(app.getPath('userData'), 'whatsapp-memories.json');
const EMBEDDING_MODEL = 'text-embedding-004';
const SUMMARIZE_MODEL = 'gemini-3-flash-preview';
const CHUNK_TOKENS = 400;
const CHUNK_OVERLAP = 80;
const CHARS_PER_TOKEN = 4; // rough estimate for Spanish text
const RECENT_MESSAGES_LIMIT = 10;
const SEMANTIC_TOP_K = 5;
const SEMANTIC_MIN_SCORE = 0.30;
const SUMMARY_TOKEN_BUDGET = 2000;
const SEMANTIC_TOKEN_BUDGET = 2000;
const FACTS_TOKEN_BUDGET = 1000;
const SUMMARIZE_THRESHOLD = 50; // messages before triggering summarization

// ─── Types ───────────────────────────────────────────────────────────
export interface MemoryContext {
  recentMessages: Array<{ role: string; content: string; timestamp: number }>;
  rollingSummary: string | null;
  semanticRecall: Array<{ text: string; score: number; timestamp: number }>;
  facts: Array<{ key: string; value: string; category: string }>;
}

interface StoredMessage {
  id: number;
  session_key: string;
  phone_number: string;
  group_jid: string | null;
  role: string;
  content: string;
  media_type: string | null;
  media_filename: string | null;
  timestamp: number;
}

// ─── SQL Schema ──────────────────────────────────────────────────────
const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_key TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    group_jid TEXT,
    role TEXT NOT NULL CHECK(role IN ('user', 'model')),
    content TEXT NOT NULL,
    media_type TEXT,
    media_filename TEXT,
    timestamp INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_messages_session_key ON messages(session_key);
CREATE INDEX IF NOT EXISTS idx_messages_phone_ts ON messages(phone_number, timestamp);
CREATE INDEX IF NOT EXISTS idx_messages_ts ON messages(timestamp);

CREATE TABLE IF NOT EXISTS summaries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_key TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    period_start INTEGER NOT NULL,
    period_end INTEGER NOT NULL,
    summary_text TEXT NOT NULL,
    message_count INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_summaries_session ON summaries(session_key);
CREATE INDEX IF NOT EXISTS idx_summaries_phone_period ON summaries(phone_number, period_end DESC);

CREATE TABLE IF NOT EXISTS memory_chunks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_key TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    chunk_text TEXT NOT NULL,
    embedding TEXT NOT NULL,
    source_type TEXT NOT NULL CHECK(source_type IN ('conversation', 'summary', 'fact')),
    source_start_time INTEGER,
    source_end_time INTEGER,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_chunks_session ON memory_chunks(session_key);
CREATE INDEX IF NOT EXISTS idx_chunks_phone ON memory_chunks(phone_number);

CREATE TABLE IF NOT EXISTS facts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone_number TEXT,
    category TEXT NOT NULL,
    fact_key TEXT NOT NULL,
    fact_value TEXT NOT NULL,
    source_context TEXT,
    confidence REAL DEFAULT 1.0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_facts_phone ON facts(phone_number);
`;

// ─── Helper: Cosine Similarity ───────────────────────────────────────
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

// ─── Helper: Truncate text to token budget ───────────────────────────
function truncateToTokens(text: string, maxTokens: number): string {
  const maxChars = maxTokens * CHARS_PER_TOKEN;
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + '...';
}

// ─── MemoryService ───────────────────────────────────────────────────
export class MemoryService extends EventEmitter {
  private db: Database.Database | null = null;
  private apiKey: string = '';
  private summarizeQueue: Set<string> = new Set();
  private isProcessingQueue: boolean = false;
  // Cache: session_key -> array of {id, embedding as number[]}
  private embeddingCache: Map<string, Array<{ id: number; embedding: number[]; startTime: number | null }>> = new Map();

  constructor() {
    super();
  }

  // ─── Initialization ────────────────────────────────────────────────

  init(): void {
    try {
      this.db = new Database(DB_PATH);
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('foreign_keys = ON');
      this.db.exec(SCHEMA_SQL);
      console.log(`[MemoryService] Database initialized at ${DB_PATH}`);
      this.migrateOldMemories();
    } catch (err: any) {
      console.error('[MemoryService] Failed to initialize database:', err.message);
    }
  }

  setApiKey(key: string): void {
    this.apiKey = key;
  }

  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      console.log('[MemoryService] Database closed');
    }
  }

  // ─── Layer 1: Message Persistence ──────────────────────────────────

  saveMessage(params: {
    sessionKey: string;
    phoneNumber: string;
    groupJid?: string;
    role: 'user' | 'model';
    content: string;
    mediaType?: string;
    mediaFilename?: string;
  }): void {
    if (!this.db || !params.content.trim()) return;

    try {
      const stmt = this.db.prepare(`
        INSERT INTO messages (session_key, phone_number, group_jid, role, content, media_type, media_filename, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        params.sessionKey,
        params.phoneNumber,
        params.groupJid || null,
        params.role,
        params.content,
        params.mediaType || null,
        params.mediaFilename || null,
        Date.now(),
      );

      // Check if we should trigger summarization
      this.checkSummarizationThreshold(params.sessionKey);
    } catch (err: any) {
      console.error('[MemoryService] saveMessage error:', err.message);
    }
  }

  getRecentMessages(sessionKey: string, limit: number = RECENT_MESSAGES_LIMIT): StoredMessage[] {
    if (!this.db) return [];
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM messages
        WHERE session_key = ?
        ORDER BY timestamp DESC
        LIMIT ?
      `);
      const rows = stmt.all(sessionKey, limit) as StoredMessage[];
      return rows.reverse(); // Return in chronological order
    } catch (err: any) {
      console.error('[MemoryService] getRecentMessages error:', err.message);
      return [];
    }
  }

  /**
   * Returns conversation history formatted for Gemini's chat history.
   * Ensures alternating user/model roles.
   */
  getConversationHistory(sessionKey: string, limit: number = RECENT_MESSAGES_LIMIT): Array<{ role: string; parts: Array<{ text: string }> }> {
    const messages = this.getRecentMessages(sessionKey, limit);
    const history: Array<{ role: string; parts: Array<{ text: string }> }> = [];

    for (const msg of messages) {
      const role = msg.role === 'user' ? 'user' : 'model';
      if (history.length > 0 && history[history.length - 1].role === role) {
        // Merge consecutive same-role messages
        history[history.length - 1].parts.push({ text: msg.content });
      } else {
        history.push({ role, parts: [{ text: msg.content }] });
      }
    }

    // Ensure starts with user
    while (history.length > 0 && history[0].role === 'model') {
      history.shift();
    }
    // Ensure ends with model (required by Gemini for history)
    while (history.length > 0 && history[history.length - 1].role === 'user') {
      history.pop();
    }

    return history;
  }

  // ─── Context Assembly (called before each Gemini call) ─────────────

  async assembleContext(sessionKey: string, phoneNumber: string, currentMessage: string): Promise<MemoryContext> {
    const context: MemoryContext = {
      recentMessages: [],
      rollingSummary: null,
      semanticRecall: [],
      facts: [],
    };

    if (!this.db) return context;

    // 1. Recent verbatim messages
    const recent = this.getRecentMessages(sessionKey, RECENT_MESSAGES_LIMIT);
    context.recentMessages = recent.map(m => ({
      role: m.role,
      content: m.content,
      timestamp: m.timestamp,
    }));

    // 2. Rolling summary
    context.rollingSummary = this.getLatestSummary(sessionKey);

    // 3. Semantic search (only if we have an API key and chunks exist)
    if (this.apiKey && currentMessage.trim().length > 10) {
      try {
        const queryEmbedding = await this.embedText(currentMessage);
        if (queryEmbedding) {
          context.semanticRecall = this.semanticSearch(sessionKey, phoneNumber, queryEmbedding, SEMANTIC_TOP_K);
        }
      } catch (err: any) {
        console.warn('[MemoryService] Semantic search failed:', err.message);
      }
    }

    // 4. Structured facts
    context.facts = this.getFacts(phoneNumber);

    return context;
  }

  /**
   * Formats the assembled memory context as text sections to inject into system prompt.
   * Respects token budgets per section.
   */
  formatContextForPrompt(ctx: MemoryContext): string {
    let sections = '';

    // Rolling summary
    if (ctx.rollingSummary) {
      const summaryText = truncateToTokens(ctx.rollingSummary, SUMMARY_TOKEN_BUDGET);
      sections += `\n\n═══ RESUMEN DE CONVERSACIONES ANTERIORES ═══\n${summaryText}`;
    }

    // Semantic recall
    if (ctx.semanticRecall.length > 0) {
      let recallText = '';
      let tokenCount = 0;
      for (const r of ctx.semanticRecall) {
        const date = new Date(r.timestamp).toLocaleDateString('es-MX', {
          day: 'numeric', month: 'short', year: 'numeric',
        });
        const entry = `[${date}] ${r.text}\n---\n`;
        const entryTokens = Math.ceil(entry.length / CHARS_PER_TOKEN);
        if (tokenCount + entryTokens > SEMANTIC_TOKEN_BUDGET) break;
        recallText += entry;
        tokenCount += entryTokens;
      }
      if (recallText) {
        sections += `\n\n═══ RECUERDOS RELEVANTES DE CONVERSACIONES PASADAS ═══\n${recallText}`;
      }
    }

    // Structured facts
    if (ctx.facts.length > 0) {
      let factsText = '';
      let tokenCount = 0;
      for (const f of ctx.facts) {
        const entry = `• [${f.category}] ${f.key}: ${f.value}\n`;
        const entryTokens = Math.ceil(entry.length / CHARS_PER_TOKEN);
        if (tokenCount + entryTokens > FACTS_TOKEN_BUDGET) break;
        factsText += entry;
        tokenCount += entryTokens;
      }
      if (factsText) {
        sections += `\n\n═══ DATOS CONOCIDOS DEL USUARIO ═══\n${factsText}`;
      }
    }

    return sections;
  }

  // ─── Layer 2: Rolling Summaries ────────────────────────────────────

  private getLatestSummary(sessionKey: string): string | null {
    if (!this.db) return null;
    try {
      const stmt = this.db.prepare(`
        SELECT summary_text FROM summaries
        WHERE session_key = ?
        ORDER BY period_end DESC
        LIMIT 1
      `);
      const row = stmt.get(sessionKey) as { summary_text: string } | undefined;
      return row?.summary_text || null;
    } catch {
      return null;
    }
  }

  private checkSummarizationThreshold(sessionKey: string): void {
    if (!this.db) return;
    try {
      // Count messages since last summary
      const lastSummary = this.db.prepare(`
        SELECT period_end FROM summaries WHERE session_key = ? ORDER BY period_end DESC LIMIT 1
      `).get(sessionKey) as { period_end: number } | undefined;

      const sinceTs = lastSummary?.period_end || 0;
      const count = this.db.prepare(`
        SELECT COUNT(*) as cnt FROM messages WHERE session_key = ? AND timestamp > ?
      `).get(sessionKey, sinceTs) as { cnt: number };

      if (count.cnt >= SUMMARIZE_THRESHOLD) {
        this.summarizeQueue.add(sessionKey);
        this.processSummarizeQueueDebounced();
      }
    } catch (err: any) {
      console.error('[MemoryService] checkSummarizationThreshold error:', err.message);
    }
  }

  private summarizeTimer: NodeJS.Timeout | null = null;
  private processSummarizeQueueDebounced(): void {
    if (this.summarizeTimer) return;
    // Debounce: wait 5 seconds after last trigger before processing
    this.summarizeTimer = setTimeout(() => {
      this.summarizeTimer = null;
      this.processSummarizeQueue();
    }, 5000);
  }

  private async processSummarizeQueue(): Promise<void> {
    if (this.isProcessingQueue || !this.apiKey || !this.db) return;
    this.isProcessingQueue = true;

    try {
      for (const sessionKey of this.summarizeQueue) {
        this.summarizeQueue.delete(sessionKey);
        await this.summarizeSession(sessionKey);
      }
    } catch (err: any) {
      console.error('[MemoryService] processSummarizeQueue error:', err.message);
    } finally {
      this.isProcessingQueue = false;
    }
  }

  private async summarizeSession(sessionKey: string): Promise<void> {
    if (!this.db || !this.apiKey) return;

    try {
      // Get messages since last summary
      const lastSummary = this.db.prepare(`
        SELECT period_end FROM summaries WHERE session_key = ? ORDER BY period_end DESC LIMIT 1
      `).get(sessionKey) as { period_end: number } | undefined;

      const sinceTs = lastSummary?.period_end || 0;
      const messages = this.db.prepare(`
        SELECT role, content, timestamp FROM messages
        WHERE session_key = ? AND timestamp > ?
        ORDER BY timestamp ASC
      `).all(sessionKey, sinceTs) as Array<{ role: string; content: string; timestamp: number }>;

      if (messages.length < SUMMARIZE_THRESHOLD) return;

      console.log(`[MemoryService] Summarizing ${messages.length} messages for ${sessionKey}`);

      // Build conversation text for summarization
      const conversationText = messages.map(m => {
        const time = new Date(m.timestamp).toLocaleString('es-MX');
        return `[${time}] ${m.role === 'user' ? 'Usuario' : 'SofLIA'}: ${m.content}`;
      }).join('\n');

      // Call Gemini to summarize
      const summary = await this.callGeminiSummarize(conversationText);
      if (!summary) return;

      const periodStart = messages[0].timestamp;
      const periodEnd = messages[messages.length - 1].timestamp;

      // Store summary
      this.db.prepare(`
        INSERT INTO summaries (session_key, phone_number, period_start, period_end, summary_text, message_count)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        sessionKey,
        sessionKey.includes(':') ? sessionKey.split(':').pop() : sessionKey,
        periodStart,
        periodEnd,
        summary,
        messages.length,
      );

      console.log(`[MemoryService] Summary saved for ${sessionKey} (${messages.length} messages)`);

      // Embed the summary and conversation chunks for semantic search
      await this.embedAndStoreChunks(sessionKey, summary, 'summary', periodStart, periodEnd);
      await this.embedConversationChunks(sessionKey, messages);

      this.emit('summary-created', { sessionKey, messageCount: messages.length });
    } catch (err: any) {
      console.error(`[MemoryService] summarizeSession error for ${sessionKey}:`, err.message);
    }
  }

  private async callGeminiSummarize(conversationText: string): Promise<string | null> {
    try {
      const genAI = new GoogleGenerativeAI(this.apiKey);
      const model = genAI.getGenerativeModel({ model: SUMMARIZE_MODEL });

      const prompt = `Resume esta conversación de WhatsApp de forma concisa pero completa. Preserva:
- Temas principales discutidos
- Decisiones tomadas
- Archivos o documentos mencionados
- Fechas importantes o plazos
- Preferencias del usuario descubiertas
- Promesas o compromisos hechos
- Resultados de acciones ejecutadas

Sé conciso (máximo 500 palabras). Escribe en tercera persona ("El usuario pidió...", "SofLIA realizó...").

CONVERSACIÓN:
${truncateToTokens(conversationText, 6000)}

RESUMEN:`;

      const result = await model.generateContent(prompt);
      return result.response.text().trim() || null;
    } catch (err: any) {
      console.error('[MemoryService] Gemini summarize error:', err.message);
      return null;
    }
  }

  // ─── Layer 3: Semantic Search (Embeddings) ─────────────────────────

  private async embedText(text: string): Promise<number[] | null> {
    if (!this.apiKey) return null;
    try {
      const genAI = new GoogleGenerativeAI(this.apiKey);
      const model = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });
      const result = await model.embedContent(text);
      return result.embedding.values;
    } catch (err: any) {
      console.error('[MemoryService] embedText error:', err.message);
      return null;
    }
  }

  private semanticSearch(
    sessionKey: string,
    phoneNumber: string,
    queryEmbedding: number[],
    topK: number,
  ): Array<{ text: string; score: number; timestamp: number }> {
    if (!this.db) return [];

    try {
      // Load chunks from cache or DB
      let chunks = this.embeddingCache.get(sessionKey);
      if (!chunks) {
        chunks = this.loadChunksFromDB(sessionKey, phoneNumber);
        this.embeddingCache.set(sessionKey, chunks);
      }

      if (chunks.length === 0) return [];

      // Compute cosine similarity for all chunks
      const scored = chunks.map(chunk => ({
        id: chunk.id,
        score: cosineSimilarity(queryEmbedding, chunk.embedding),
        startTime: chunk.startTime,
      }));

      // Sort by score descending, take top K above threshold
      scored.sort((a, b) => b.score - a.score);
      const topResults = scored.filter(s => s.score >= SEMANTIC_MIN_SCORE).slice(0, topK);

      if (topResults.length === 0) return [];

      // Fetch chunk texts for the top results
      const ids = topResults.map(r => r.id);
      const placeholders = ids.map(() => '?').join(',');
      const rows = this.db.prepare(`
        SELECT id, chunk_text, source_start_time FROM memory_chunks WHERE id IN (${placeholders})
      `).all(...ids) as Array<{ id: number; chunk_text: string; source_start_time: number | null }>;

      const rowMap = new Map(rows.map(r => [r.id, r]));

      return topResults.map(r => {
        const row = rowMap.get(r.id);
        return {
          text: row?.chunk_text || '',
          score: r.score,
          timestamp: row?.source_start_time || 0,
        };
      }).filter(r => r.text);
    } catch (err: any) {
      console.error('[MemoryService] semanticSearch error:', err.message);
      return [];
    }
  }

  private loadChunksFromDB(sessionKey: string, phoneNumber: string): Array<{ id: number; embedding: number[]; startTime: number | null }> {
    if (!this.db) return [];
    try {
      const rows = this.db.prepare(`
        SELECT id, embedding, source_start_time FROM memory_chunks
        WHERE session_key = ? OR phone_number = ?
        ORDER BY source_start_time DESC
        LIMIT 5000
      `).all(sessionKey, phoneNumber) as Array<{ id: number; embedding: string; source_start_time: number | null }>;

      return rows.map(r => ({
        id: r.id,
        embedding: JSON.parse(r.embedding) as number[],
        startTime: r.source_start_time,
      }));
    } catch (err: any) {
      console.error('[MemoryService] loadChunksFromDB error:', err.message);
      return [];
    }
  }

  private async embedAndStoreChunks(
    sessionKey: string,
    text: string,
    sourceType: 'conversation' | 'summary' | 'fact',
    startTime: number,
    endTime: number,
  ): Promise<void> {
    if (!this.db || !this.apiKey) return;

    const chunks = this.chunkText(text);
    const phoneNumber = sessionKey.includes(':') ? sessionKey.split(':').pop()! : sessionKey;

    for (const chunk of chunks) {
      try {
        const embedding = await this.embedText(chunk);
        if (!embedding) continue;

        this.db.prepare(`
          INSERT INTO memory_chunks (session_key, phone_number, chunk_text, embedding, source_type, source_start_time, source_end_time)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          sessionKey,
          phoneNumber,
          chunk,
          JSON.stringify(embedding),
          sourceType,
          startTime,
          endTime,
        );
      } catch (err: any) {
        console.error('[MemoryService] embedAndStoreChunks error:', err.message);
      }
    }

    // Invalidate embedding cache for this session
    this.embeddingCache.delete(sessionKey);
  }

  private async embedConversationChunks(
    sessionKey: string,
    messages: Array<{ role: string; content: string; timestamp: number }>,
  ): Promise<void> {
    // Build conversation text with timestamps for context
    const text = messages.map(m => {
      const date = new Date(m.timestamp).toLocaleDateString('es-MX');
      return `[${date}] ${m.role === 'user' ? 'Usuario' : 'SofLIA'}: ${m.content}`;
    }).join('\n');

    const startTime = messages[0]?.timestamp || Date.now();
    const endTime = messages[messages.length - 1]?.timestamp || Date.now();

    await this.embedAndStoreChunks(sessionKey, text, 'conversation', startTime, endTime);
  }

  // ─── Chunking ──────────────────────────────────────────────────────

  private chunkText(text: string): string[] {
    const chunkSize = CHUNK_TOKENS * CHARS_PER_TOKEN;
    const overlap = CHUNK_OVERLAP * CHARS_PER_TOKEN;

    if (text.length <= chunkSize) return [text];

    const chunks: string[] = [];
    let start = 0;

    while (start < text.length) {
      let end = start + chunkSize;
      if (end >= text.length) {
        chunks.push(text.slice(start));
        break;
      }

      // Try to break at a newline or period near the end
      const searchStart = Math.max(start + chunkSize - overlap, start);
      const segment = text.slice(searchStart, end);
      const lastNewline = segment.lastIndexOf('\n');
      const lastPeriod = segment.lastIndexOf('. ');

      if (lastNewline > 0) {
        end = searchStart + lastNewline + 1;
      } else if (lastPeriod > 0) {
        end = searchStart + lastPeriod + 2;
      }

      chunks.push(text.slice(start, end));
      start = end - overlap;
    }

    return chunks.filter(c => c.trim().length > 20);
  }

  // ─── Facts (structured memory, replaces whatsapp-memories.json) ────

  saveFact(params: {
    phoneNumber: string | null;
    category: string;
    key: string;
    value: string;
    context?: string;
  }): { success: boolean; message?: string } {
    if (!this.db) return { success: false, message: 'Database not initialized' };

    try {
      // Upsert: if same phone+category+key exists, update it
      this.db.prepare(`
        INSERT INTO facts (phone_number, category, fact_key, fact_value, source_context, updated_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(phone_number, category, fact_key) DO UPDATE SET
          fact_value = excluded.fact_value,
          source_context = excluded.source_context,
          updated_at = datetime('now'),
          confidence = 1.0
      `).run(
        params.phoneNumber,
        params.category,
        params.key,
        params.value,
        params.context || null,
      );

      console.log(`[MemoryService] Fact saved: [${params.category}] ${params.key} = ${params.value}`);
      return { success: true, message: 'Dato guardado.' };
    } catch (err: any) {
      console.error('[MemoryService] saveFact error:', err.message);
      return { success: false, message: err.message };
    }
  }

  getFacts(phoneNumber: string): Array<{ key: string; value: string; category: string }> {
    if (!this.db) return [];
    try {
      const rows = this.db.prepare(`
        SELECT fact_key, fact_value, category FROM facts
        WHERE phone_number = ? OR phone_number IS NULL
        ORDER BY updated_at DESC
        LIMIT 50
      `).all(phoneNumber) as Array<{ fact_key: string; fact_value: string; category: string }>;

      return rows.map(r => ({ key: r.fact_key, value: r.fact_value, category: r.category }));
    } catch (err: any) {
      console.error('[MemoryService] getFacts error:', err.message);
      return [];
    }
  }

  deleteFact(factId: number): boolean {
    if (!this.db) return false;
    try {
      this.db.prepare('DELETE FROM facts WHERE id = ?').run(factId);
      return true;
    } catch {
      return false;
    }
  }

  // ─── Explicit semantic search (for agent tool) ─────────────────────

  async searchMemory(sessionKey: string, phoneNumber: string, query: string, maxResults: number = SEMANTIC_TOP_K): Promise<Array<{ text: string; score: number; date: string }>> {
    if (!this.apiKey) return [];

    try {
      const queryEmbedding = await this.embedText(query);
      if (!queryEmbedding) return [];

      const results = this.semanticSearch(sessionKey, phoneNumber, queryEmbedding, maxResults);
      return results.map(r => ({
        text: r.text,
        score: Math.round(r.score * 100) / 100,
        date: r.timestamp ? new Date(r.timestamp).toLocaleDateString('es-MX') : 'desconocida',
      }));
    } catch (err: any) {
      console.error('[MemoryService] searchMemory error:', err.message);
      return [];
    }
  }

  // ─── Maintenance ───────────────────────────────────────────────────

  async compactOldData(daysToKeep: number = 90): Promise<{ deletedMessages: number; deletedChunks: number }> {
    if (!this.db) return { deletedMessages: 0, deletedChunks: 0 };

    const cutoff = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);

    try {
      const msgResult = this.db.prepare('DELETE FROM messages WHERE timestamp < ?').run(cutoff);
      const chunkResult = this.db.prepare('DELETE FROM memory_chunks WHERE source_end_time < ?').run(cutoff);

      // Clear embedding cache
      this.embeddingCache.clear();

      const result = {
        deletedMessages: msgResult.changes,
        deletedChunks: chunkResult.changes,
      };
      console.log(`[MemoryService] Compacted: ${result.deletedMessages} messages, ${result.deletedChunks} chunks older than ${daysToKeep} days`);
      return result;
    } catch (err: any) {
      console.error('[MemoryService] compactOldData error:', err.message);
      return { deletedMessages: 0, deletedChunks: 0 };
    }
  }

  getStats(sessionKey?: string): { messageCount: number; chunkCount: number; factCount: number; summaryCount: number } {
    if (!this.db) return { messageCount: 0, chunkCount: 0, factCount: 0, summaryCount: 0 };

    try {
      const where = sessionKey ? 'WHERE session_key = ?' : '';
      const params = sessionKey ? [sessionKey] : [];

      const msgCount = (this.db.prepare(`SELECT COUNT(*) as cnt FROM messages ${where}`).get(...params) as any).cnt;
      const chunkCount = (this.db.prepare(`SELECT COUNT(*) as cnt FROM memory_chunks ${where}`).get(...params) as any).cnt;
      const summaryCount = (this.db.prepare(`SELECT COUNT(*) as cnt FROM summaries ${where}`).get(...params) as any).cnt;
      const factCount = (this.db.prepare('SELECT COUNT(*) as cnt FROM facts').get() as any).cnt;

      return { messageCount: msgCount, chunkCount, factCount, summaryCount };
    } catch {
      return { messageCount: 0, chunkCount: 0, factCount: 0, summaryCount: 0 };
    }
  }

  /**
   * Clear recent conversation context (for /reset command).
   * Does NOT delete persisted messages — those stay for long-term recall.
   */
  clearSessionContext(sessionKey: string): void {
    // The conversation history for Gemini is rebuilt from SQLite each time.
    // Clearing just means the next getConversationHistory() will return a fresh window.
    // We don't need to delete anything — the history trimming in getConversationHistory
    // already only returns the most recent N messages.
    // But we can add a "reset marker" so getConversationHistory starts fresh.
    if (!this.db) return;
    try {
      // Insert a special reset marker
      this.db.prepare(`
        INSERT INTO messages (session_key, phone_number, group_jid, role, content, timestamp)
        VALUES (?, '', NULL, 'user', '__RESET__', ?)
      `).run(sessionKey, Date.now());
    } catch (err: any) {
      console.error('[MemoryService] clearSessionContext error:', err.message);
    }
  }

  /**
   * Get conversation history, respecting reset markers.
   */
  getConversationHistorySinceReset(sessionKey: string, limit: number = RECENT_MESSAGES_LIMIT): Array<{ role: string; parts: Array<{ text: string }> }> {
    if (!this.db) return [];

    try {
      // Find the most recent reset marker
      const resetRow = this.db.prepare(`
        SELECT timestamp FROM messages
        WHERE session_key = ? AND content = '__RESET__'
        ORDER BY timestamp DESC LIMIT 1
      `).get(sessionKey) as { timestamp: number } | undefined;

      const sinceTs = resetRow?.timestamp || 0;

      const messages = this.db.prepare(`
        SELECT role, content, timestamp FROM messages
        WHERE session_key = ? AND timestamp > ? AND content != '__RESET__'
        ORDER BY timestamp DESC
        LIMIT ?
      `).all(sessionKey, sinceTs, limit) as Array<{ role: string; content: string; timestamp: number }>;

      // Reverse to chronological
      messages.reverse();

      const history: Array<{ role: string; parts: Array<{ text: string }> }> = [];
      for (const msg of messages) {
        const role = msg.role === 'user' ? 'user' : 'model';
        if (history.length > 0 && history[history.length - 1].role === role) {
          history[history.length - 1].parts.push({ text: msg.content });
        } else {
          history.push({ role, parts: [{ text: msg.content }] });
        }
      }

      // Ensure starts with user
      while (history.length > 0 && history[0].role === 'model') {
        history.shift();
      }
      // Ensure ends with model
      while (history.length > 0 && history[history.length - 1].role === 'user') {
        history.pop();
      }

      return history;
    } catch (err: any) {
      console.error('[MemoryService] getConversationHistorySinceReset error:', err.message);
      return [];
    }
  }

  // ─── Migration: whatsapp-memories.json → facts table ───────────────

  private migrateOldMemories(): void {
    try {
      if (!fs.existsSync(OLD_MEMORIES_PATH)) return;

      const data = JSON.parse(fs.readFileSync(OLD_MEMORIES_PATH, 'utf-8'));
      if (!Array.isArray(data) || data.length === 0) return;

      console.log(`[MemoryService] Migrating ${data.length} memories from whatsapp-memories.json`);

      for (const memory of data) {
        const lesson = memory.lesson || memory.text || '';
        if (!lesson.trim()) continue;

        // Generate a short key from the lesson
        const key = lesson.slice(0, 50).replace(/[^a-zA-Z0-9áéíóúñ\s]/g, '').trim().replace(/\s+/g, '_').toLowerCase();

        this.saveFact({
          phoneNumber: null, // Global fact
          category: 'correction',
          key: key || `legacy_${Date.now()}`,
          value: lesson,
          context: memory.context || 'Migrado de whatsapp-memories.json',
        });
      }

      // Rename old file
      const backupPath = OLD_MEMORIES_PATH + '.migrated';
      fs.renameSync(OLD_MEMORIES_PATH, backupPath);
      console.log(`[MemoryService] Migration complete. Old file renamed to ${backupPath}`);
    } catch (err: any) {
      console.error('[MemoryService] Migration error:', err.message);
    }
  }
}
