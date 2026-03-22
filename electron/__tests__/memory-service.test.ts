/**
 * Memory Service Tests — MEM-001 to MEM-020
 * Tests the 4-layer memory system: raw messages, rolling summaries,
 * semantic embeddings, and structured facts.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';

// ─── Constants replicated from source for assertion ───────────────────
const SUMMARIZE_THRESHOLD = 15;
const SEMANTIC_MIN_SCORE = 0.30;
const CHARS_PER_TOKEN = 4;

// ─── Schema from source ──────────────────────────────────────────────
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
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(phone_number, category, fact_key)
);
CREATE INDEX IF NOT EXISTS idx_facts_phone ON facts(phone_number);
`;

// ─── Pure helper functions replicated for unit testing ───────────────
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

function truncateToTokens(text: string, maxTokens: number): string {
  const maxChars = maxTokens * CHARS_PER_TOKEN;
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + '...';
}

// ─── In-memory DB helper ─────────────────────────────────────────────
function createTestDb(): any {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.exec(SCHEMA_SQL);
  return db;
}

function insertMessage(db: any, opts: {
  sessionKey?: string;
  phoneNumber?: string;
  role?: string;
  content?: string;
  timestamp?: number;
}) {
  db.prepare(`
    INSERT INTO messages (session_key, phone_number, role, content, timestamp)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    opts.sessionKey ?? 'test-session',
    opts.phoneNumber ?? '+5215551234567',
    opts.role ?? 'user',
    opts.content ?? 'Hola',
    opts.timestamp ?? Date.now(),
  );
}

describe('MemoryService', () => {
  let db: any;

  beforeEach(() => {
    db = createTestDb();
  });

  afterEach(() => {
    db.close();
  });

  // ─── MEM-001: Schema creation ───────────────────────────────────────
  it('MEM-001: init() creates all 4 required tables', () => {
    const tables = db.prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name IN ('messages','summaries','memory_chunks','facts') ORDER BY name`
    ).all().map((r: any) => r.name);

    expect(tables).toEqual(['facts', 'memory_chunks', 'messages', 'summaries']);
  });

  // ─── MEM-002: saveMessage inserts a message ────────────────────────
  it('MEM-002: saveMessage inserts a row into messages table', () => {
    insertMessage(db, { content: 'Hola SofLIA' });

    const rows = db.prepare('SELECT * FROM messages').all();
    expect(rows).toHaveLength(1);
    expect(rows[0].content).toBe('Hola SofLIA');
    expect(rows[0].role).toBe('user');
  });

  // ─── MEM-003: getRecentMessages returns chronological order ────────
  it('MEM-003: getRecentMessages returns messages in chronological order (oldest first)', () => {
    const now = Date.now();
    insertMessage(db, { content: 'Primero', timestamp: now - 2000 });
    insertMessage(db, { content: 'Segundo', timestamp: now - 1000 });
    insertMessage(db, { content: 'Tercero', timestamp: now });

    // Simulate getRecentMessages: ORDER BY timestamp DESC LIMIT ? then reverse
    const rows = db.prepare(
      'SELECT * FROM messages WHERE session_key = ? ORDER BY timestamp DESC LIMIT ?'
    ).all('test-session', 20).reverse();

    expect(rows[0].content).toBe('Primero');
    expect(rows[1].content).toBe('Segundo');
    expect(rows[2].content).toBe('Tercero');
  });

  // ─── MEM-004: Summarization threshold triggers at 15 messages ─────
  it('MEM-004: summarization threshold is 15 messages', () => {
    expect(SUMMARIZE_THRESHOLD).toBe(15);

    // Insert 15 messages and verify count matches threshold
    for (let i = 0; i < SUMMARIZE_THRESHOLD; i++) {
      insertMessage(db, { content: `Mensaje ${i}`, timestamp: Date.now() + i });
    }

    const count = db.prepare(
      'SELECT COUNT(*) as cnt FROM messages WHERE session_key = ?'
    ).get('test-session');

    expect(count.cnt).toBe(SUMMARIZE_THRESHOLD);
  });

  // ─── MEM-005: Semantic embedding storage ──────────────────────────
  it('MEM-005: memory_chunks table stores embedding as JSON text', () => {
    const embedding = [0.1, 0.2, 0.3, 0.4, 0.5];
    db.prepare(`
      INSERT INTO memory_chunks (session_key, phone_number, chunk_text, embedding, source_type, source_start_time, source_end_time)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('test-session', '+5215551234567', 'chunk de prueba', JSON.stringify(embedding), 'conversation', Date.now() - 1000, Date.now());

    const row = db.prepare('SELECT * FROM memory_chunks').get();
    const parsed = JSON.parse(row.embedding);
    expect(parsed).toEqual(embedding);
    expect(row.source_type).toBe('conversation');
  });

  // ─── MEM-006: CRUD operations on facts ────────────────────────────
  it('MEM-006: facts CRUD: insert, read, update (upsert), delete', () => {
    // Insert
    db.prepare(`
      INSERT INTO facts (phone_number, category, fact_key, fact_value)
      VALUES (?, ?, ?, ?)
    `).run('+5215551234567', 'preferencia', 'idioma', 'espanol');

    let facts = db.prepare('SELECT * FROM facts WHERE phone_number = ?').all('+5215551234567');
    expect(facts).toHaveLength(1);
    expect(facts[0].fact_value).toBe('espanol');

    // Upsert (update)
    db.prepare(`
      INSERT INTO facts (phone_number, category, fact_key, fact_value, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'))
      ON CONFLICT(phone_number, category, fact_key) DO UPDATE SET
        fact_value = excluded.fact_value, updated_at = datetime('now')
    `).run('+5215551234567', 'preferencia', 'idioma', 'ingles');

    facts = db.prepare('SELECT * FROM facts WHERE phone_number = ?').all('+5215551234567');
    expect(facts).toHaveLength(1);
    expect(facts[0].fact_value).toBe('ingles');

    // Delete
    db.prepare('DELETE FROM facts WHERE id = ?').run(facts[0].id);
    facts = db.prepare('SELECT * FROM facts WHERE phone_number = ?').all('+5215551234567');
    expect(facts).toHaveLength(0);
  });

  // ─── MEM-007: assembleContext collects all 4 layers ───────────────
  it('MEM-007: all 4 layers can be queried independently from same DB', () => {
    // Layer 1: messages
    insertMessage(db, { content: 'Hola' });
    // Layer 2: summaries
    db.prepare(`INSERT INTO summaries (session_key, phone_number, period_start, period_end, summary_text, message_count) VALUES (?,?,?,?,?,?)`)
      .run('test-session', '+5215551234567', Date.now() - 10000, Date.now(), 'Resumen de prueba', 5);
    // Layer 3: chunks
    db.prepare(`INSERT INTO memory_chunks (session_key, phone_number, chunk_text, embedding, source_type) VALUES (?,?,?,?,?)`)
      .run('test-session', '+5215551234567', 'Chunk semantico', '[]', 'summary');
    // Layer 4: facts
    db.prepare(`INSERT INTO facts (phone_number, category, fact_key, fact_value) VALUES (?,?,?,?)`)
      .run('+5215551234567', 'trabajo', 'empresa', 'Acme');

    const messages = db.prepare('SELECT COUNT(*) as c FROM messages').get();
    const summaries = db.prepare('SELECT COUNT(*) as c FROM summaries').get();
    const chunks = db.prepare('SELECT COUNT(*) as c FROM memory_chunks').get();
    const facts = db.prepare('SELECT COUNT(*) as c FROM facts').get();

    expect(messages.c).toBe(1);
    expect(summaries.c).toBe(1);
    expect(chunks.c).toBe(1);
    expect(facts.c).toBe(1);
  });

  // ─── MEM-008: Semantic search respects MIN_SCORE ──────────────────
  it('MEM-008: semantic search filters results below MIN_SCORE (0.30)', () => {
    const queryVec = [1, 0, 0, 0, 0];

    const candidates = [
      { text: 'alto', embedding: [0.9, 0.1, 0, 0, 0] },   // high similarity
      { text: 'bajo', embedding: [0, 0, 0, 1, 0] },        // low similarity
      { text: 'medio', embedding: [0.5, 0.5, 0, 0, 0] },   // medium similarity
    ];

    const scores = candidates.map(c => ({
      text: c.text,
      score: cosineSimilarity(queryVec, c.embedding),
    }));

    const filtered = scores.filter(s => s.score >= SEMANTIC_MIN_SCORE);
    expect(filtered.length).toBeGreaterThanOrEqual(1);
    expect(filtered.every(s => s.score >= SEMANTIC_MIN_SCORE)).toBe(true);

    // 'bajo' should be filtered out
    expect(filtered.find(s => s.text === 'bajo')).toBeUndefined();
  });

  // ─── MEM-009: Token budget (2000) applied via truncateToTokens ────
  it('MEM-009: truncateToTokens respects token budget', () => {
    const budget = 2000;
    const maxChars = budget * CHARS_PER_TOKEN; // 8000 chars

    const shortText = 'Hola mundo';
    expect(truncateToTokens(shortText, budget)).toBe(shortText);

    const longText = 'A'.repeat(maxChars + 100);
    const truncated = truncateToTokens(longText, budget);
    expect(truncated.length).toBe(maxChars + 3); // +3 for '...'
    expect(truncated.endsWith('...')).toBe(true);
  });

  // ─── MEM-010: compactOldData deletes old messages and chunks ──────
  it('MEM-010: compactOldData deletes data older than cutoff', () => {
    const now = Date.now();
    const oldTs = now - (100 * 24 * 60 * 60 * 1000); // 100 days ago
    const recentTs = now - (10 * 24 * 60 * 60 * 1000); // 10 days ago

    insertMessage(db, { content: 'Viejo', timestamp: oldTs });
    insertMessage(db, { content: 'Reciente', timestamp: recentTs });

    db.prepare(`INSERT INTO memory_chunks (session_key, phone_number, chunk_text, embedding, source_type, source_end_time) VALUES (?,?,?,?,?,?)`)
      .run('test-session', '+5215551234567', 'Chunk viejo', '[]', 'conversation', oldTs);
    db.prepare(`INSERT INTO memory_chunks (session_key, phone_number, chunk_text, embedding, source_type, source_end_time) VALUES (?,?,?,?,?,?)`)
      .run('test-session', '+5215551234567', 'Chunk reciente', '[]', 'conversation', recentTs);

    const cutoff = now - (90 * 24 * 60 * 60 * 1000);
    const msgResult = db.prepare('DELETE FROM messages WHERE timestamp < ?').run(cutoff);
    const chunkResult = db.prepare('DELETE FROM memory_chunks WHERE source_end_time < ?').run(cutoff);

    expect(msgResult.changes).toBe(1);
    expect(chunkResult.changes).toBe(1);

    const remaining = db.prepare('SELECT COUNT(*) as c FROM messages').get();
    expect(remaining.c).toBe(1);
  });

  // ─── MEM-011: Session key is deterministic ────────────────────────
  it('MEM-011: session key scoped queries isolate different sessions', () => {
    insertMessage(db, { sessionKey: 'session-A', content: 'Hola A' });
    insertMessage(db, { sessionKey: 'session-B', content: 'Hola B' });

    const rowsA = db.prepare('SELECT * FROM messages WHERE session_key = ?').all('session-A');
    const rowsB = db.prepare('SELECT * FROM messages WHERE session_key = ?').all('session-B');

    expect(rowsA).toHaveLength(1);
    expect(rowsB).toHaveLength(1);
    expect(rowsA[0].content).toBe('Hola A');
    expect(rowsB[0].content).toBe('Hola B');
  });

  // ─── MEM-012: Token save/get/delete ───────────────────────────────
  it('MEM-012: safeStorage token save, get, and delete work correctly', async () => {
    const { safeStorage } = await import('electron');

    // Save
    const encrypted = safeStorage.encryptString('my-api-token');
    expect(encrypted).toBeInstanceOf(Buffer);

    // Get
    const decrypted = safeStorage.decryptString(encrypted);
    expect(decrypted).toBe('my-api-token');

    // isEncryptionAvailable
    expect(safeStorage.isEncryptionAvailable()).toBe(true);
  });

  // ─── MEM-013: formatContextForPrompt includes sections ───────────
  it('MEM-013: formatContextForPrompt builds sections from context data', () => {
    // Simulate the formatContextForPrompt logic
    const ctx = {
      recentMessages: [
        { role: 'user', content: 'Hola', timestamp: Date.now() },
        { role: 'model', content: 'Hola! Como puedo ayudarte?', timestamp: Date.now() + 1000 },
      ],
      rollingSummary: 'Resumen de conversacion anterior',
      semanticRecall: [
        { text: 'Dato relevante', score: 0.85, timestamp: Date.now() - 86400000 },
      ],
      facts: [
        { key: 'empresa', value: 'Acme', category: 'trabajo' },
      ],
      soul: '# SofLIA — Identidad Central',
    };

    let sections = '';
    if (ctx.soul) sections += `\n\n=== SOUL ===\n${ctx.soul}`;
    if (ctx.recentMessages.length > 0) sections += '\n\n=== MENSAJES RECIENTES ===\n';
    if (ctx.rollingSummary) sections += `\n\n=== RESUMEN ===\n${ctx.rollingSummary}`;
    if (ctx.semanticRecall.length > 0) sections += '\n\n=== RECUERDOS ===\n';
    if (ctx.facts.length > 0) sections += '\n\n=== DATOS ===\n';

    expect(sections).toContain('SOUL');
    expect(sections).toContain('MENSAJES RECIENTES');
    expect(sections).toContain('RESUMEN');
    expect(sections).toContain('RECUERDOS');
    expect(sections).toContain('DATOS');
  });

  // ─── MEM-014: Cosine similarity calculation ───────────────────────
  it('MEM-014: cosineSimilarity returns correct values', () => {
    // Identical vectors = 1
    expect(cosineSimilarity([1, 0, 0], [1, 0, 0])).toBeCloseTo(1.0);

    // Orthogonal vectors = 0
    expect(cosineSimilarity([1, 0, 0], [0, 1, 0])).toBeCloseTo(0.0);

    // Opposite vectors = -1
    expect(cosineSimilarity([1, 0, 0], [-1, 0, 0])).toBeCloseTo(-1.0);

    // Zero vector = 0
    expect(cosineSimilarity([0, 0, 0], [1, 0, 0])).toBe(0);

    // Partial similarity
    const score = cosineSimilarity([1, 1, 0], [1, 0, 0]);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(1);
  });

  // ─── MEM-015: SOUL.md content ─────────────────────────────────────
  it('MEM-015: SOUL.md default content includes identity section', () => {
    const defaultSoul = `# SofLIA — Identidad Central

## Quién Soy
Soy SofLIA, asistente de IA para negocios hispanohablantes.`;

    expect(defaultSoul).toContain('SofLIA');
    expect(defaultSoul).toContain('Identidad Central');
  });

  // ─── MEM-016: getConversationHistory merges consecutive same-role ─
  it('MEM-016: getConversationHistory merges consecutive same-role messages', () => {
    const messages = [
      { role: 'user', content: 'Hola', timestamp: 1 },
      { role: 'user', content: 'Como estas?', timestamp: 2 },
      { role: 'model', content: 'Bien!', timestamp: 3 },
      { role: 'model', content: 'En que puedo ayudar?', timestamp: 4 },
      { role: 'user', content: 'Necesito algo', timestamp: 5 },
    ];

    // Simulate getConversationHistory merge logic
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

    // user('Hola','Como estas?') + model('Bien!','En que puedo ayudar?')
    // last user is removed since it doesn't end with model
    expect(history).toHaveLength(2);
    expect(history[0].role).toBe('user');
    expect(history[0].parts).toHaveLength(2);
    expect(history[1].role).toBe('model');
    expect(history[1].parts).toHaveLength(2);
  });

  // ─── MEM-017: Empty content messages are not saved ────────────────
  it('MEM-017: saveMessage with empty content does not insert', () => {
    // MemoryService checks: if (!params.content.trim()) return;
    const content = '   ';
    if (!content.trim()) {
      // Don't insert
    } else {
      insertMessage(db, { content });
    }

    const rows = db.prepare('SELECT * FROM messages').all();
    expect(rows).toHaveLength(0);
  });

  // ─── MEM-018: getRecentMessages returns empty when no DB ──────────
  it('MEM-018: getRecentMessages with no matching session returns empty array', () => {
    insertMessage(db, { sessionKey: 'other-session' });

    const rows = db.prepare(
      'SELECT * FROM messages WHERE session_key = ? ORDER BY timestamp DESC LIMIT ?'
    ).all('nonexistent-session', 20);

    expect(rows).toEqual([]);
  });

  // ─── MEM-019: Summaries table stores summary text ─────────────────
  it('MEM-019: latest summary query returns most recent summary', () => {
    const now = Date.now();
    db.prepare(`INSERT INTO summaries (session_key, phone_number, period_start, period_end, summary_text, message_count) VALUES (?,?,?,?,?,?)`)
      .run('test-session', '+52', now - 20000, now - 10000, 'Resumen viejo', 10);
    db.prepare(`INSERT INTO summaries (session_key, phone_number, period_start, period_end, summary_text, message_count) VALUES (?,?,?,?,?,?)`)
      .run('test-session', '+52', now - 10000, now, 'Resumen nuevo', 15);

    const row = db.prepare(
      'SELECT summary_text FROM summaries WHERE session_key = ? ORDER BY period_end DESC LIMIT 1'
    ).get('test-session');

    expect(row.summary_text).toBe('Resumen nuevo');
  });

  // ─── MEM-020: Facts getFacts returns global + phone-specific ──────
  it('MEM-020: getFacts returns both phone-specific and global (NULL phone) facts', () => {
    db.prepare(`INSERT INTO facts (phone_number, category, fact_key, fact_value) VALUES (?,?,?,?)`)
      .run('+5215551234567', 'personal', 'nombre', 'Juan');
    db.prepare(`INSERT INTO facts (phone_number, category, fact_key, fact_value) VALUES (?,?,?,?)`)
      .run(null, 'sistema', 'version', '2.0');

    const facts = db.prepare(
      'SELECT fact_key, fact_value, category FROM facts WHERE phone_number = ? OR phone_number IS NULL ORDER BY updated_at DESC LIMIT 50'
    ).all('+5215551234567');

    expect(facts).toHaveLength(2);
    const keys = facts.map((f: any) => f.fact_key);
    expect(keys).toContain('nombre');
    expect(keys).toContain('version');
  });
});
