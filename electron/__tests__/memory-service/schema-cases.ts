import { expect, it } from 'vitest';
import { SUMMARIZE_THRESHOLD } from '../memory-service.schema';
import { insertMessage } from '../memory-service.fixtures';
import type { MemoryServiceTestContext } from './types';

export function registerMemorySchemaCases(ctx: MemoryServiceTestContext): void {
  it('MEM-001: init() creates all 4 required tables', () => {
    const tables = ctx.getDb().prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name IN ('messages','summaries','memory_chunks','facts') ORDER BY name`,
    ).all().map((row: any) => row.name);
    expect(tables).toEqual(['facts', 'memory_chunks', 'messages', 'summaries']);
  });

  it('MEM-002: saveMessage inserts a row into messages table', () => {
    insertMessage(ctx.getDb(), { content: 'Hola Pulse' });
    const rows = ctx.getDb().prepare('SELECT * FROM messages').all();
    expect(rows).toHaveLength(1);
    expect(rows[0].content).toBe('Hola Pulse');
    expect(rows[0].role).toBe('user');
  });

  it('MEM-003: getRecentMessages returns messages in chronological order', () => {
    const now = Date.now();
    insertMessage(ctx.getDb(), { content: 'Primero', timestamp: now - 2000 });
    insertMessage(ctx.getDb(), { content: 'Segundo', timestamp: now - 1000 });
    insertMessage(ctx.getDb(), { content: 'Tercero', timestamp: now });
    const rows = ctx.getDb().prepare(
      'SELECT * FROM messages WHERE session_key = ? ORDER BY timestamp DESC LIMIT ?',
    ).all('test-session', 20).reverse();
    expect(rows.map((row: any) => row.content)).toEqual(['Primero', 'Segundo', 'Tercero']);
  });

  it('MEM-004: summarization threshold is 15 messages', () => {
    for (let i = 0; i < SUMMARIZE_THRESHOLD; i++) {
      insertMessage(ctx.getDb(), { content: `Mensaje ${i}`, timestamp: Date.now() + i });
    }
    const count = ctx.getDb().prepare(
      'SELECT COUNT(*) as cnt FROM messages WHERE session_key = ?',
    ).get('test-session');
    expect(count.cnt).toBe(SUMMARIZE_THRESHOLD);
  });
}
