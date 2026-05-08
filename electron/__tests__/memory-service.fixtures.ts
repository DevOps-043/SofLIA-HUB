import Database from 'better-sqlite3';
import { CHARS_PER_TOKEN, SCHEMA_SQL } from './memory-service.schema';

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

export function truncateToTokens(text: string, maxTokens: number): string {
  const maxChars = maxTokens * CHARS_PER_TOKEN;
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + '...';
}

export function createTestDb(): any {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.exec(SCHEMA_SQL);
  return db;
}

export function insertMessage(db: any, opts: {
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
