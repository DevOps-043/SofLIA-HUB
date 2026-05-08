import { expect, it } from 'vitest';
import { insertMessage } from '../memory-service.fixtures';
import type { MemoryServiceTestContext } from './types';

export function registerMemoryStorageCases(ctx: MemoryServiceTestContext): void {
  it('MEM-005: memory_chunks table stores embedding as JSON text', () => {
    const embedding = [0.1, 0.2, 0.3, 0.4, 0.5];
    ctx.getDb().prepare(`
      INSERT INTO memory_chunks (session_key, phone_number, chunk_text, embedding, source_type, source_start_time, source_end_time)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('test-session', '+5215551234567', 'chunk de prueba', JSON.stringify(embedding), 'conversation', Date.now() - 1000, Date.now());
    const row = ctx.getDb().prepare('SELECT * FROM memory_chunks').get();
    expect(JSON.parse(row.embedding)).toEqual(embedding);
    expect(row.source_type).toBe('conversation');
  });

  it('MEM-006: facts CRUD: insert, read, update, delete', () => {
    ctx.getDb().prepare('INSERT INTO facts (phone_number, category, fact_key, fact_value) VALUES (?, ?, ?, ?)')
      .run('+5215551234567', 'preferencia', 'idioma', 'espanol');
    let facts = ctx.getDb().prepare('SELECT * FROM facts WHERE phone_number = ?').all('+5215551234567');
    expect(facts[0].fact_value).toBe('espanol');

    ctx.getDb().prepare(`
      INSERT INTO facts (phone_number, category, fact_key, fact_value, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'))
      ON CONFLICT(phone_number, category, fact_key) DO UPDATE SET fact_value = excluded.fact_value, updated_at = datetime('now')
    `).run('+5215551234567', 'preferencia', 'idioma', 'ingles');
    facts = ctx.getDb().prepare('SELECT * FROM facts WHERE phone_number = ?').all('+5215551234567');
    expect(facts[0].fact_value).toBe('ingles');

    ctx.getDb().prepare('DELETE FROM facts WHERE id = ?').run(facts[0].id);
    facts = ctx.getDb().prepare('SELECT * FROM facts WHERE phone_number = ?').all('+5215551234567');
    expect(facts).toHaveLength(0);
  });

  it('MEM-007: all 4 layers can be queried independently from same DB', () => {
    insertMessage(ctx.getDb(), { content: 'Hola' });
    ctx.getDb().prepare('INSERT INTO summaries (session_key, phone_number, period_start, period_end, summary_text, message_count) VALUES (?,?,?,?,?,?)')
      .run('test-session', '+5215551234567', Date.now() - 10000, Date.now(), 'Resumen de prueba', 5);
    ctx.getDb().prepare('INSERT INTO memory_chunks (session_key, phone_number, chunk_text, embedding, source_type) VALUES (?,?,?,?,?)')
      .run('test-session', '+5215551234567', 'Chunk semantico', '[]', 'summary');
    ctx.getDb().prepare('INSERT INTO facts (phone_number, category, fact_key, fact_value) VALUES (?,?,?,?)')
      .run('+5215551234567', 'trabajo', 'empresa', 'Acme');
    expect(ctx.getDb().prepare('SELECT COUNT(*) as c FROM messages').get().c).toBe(1);
    expect(ctx.getDb().prepare('SELECT COUNT(*) as c FROM summaries').get().c).toBe(1);
    expect(ctx.getDb().prepare('SELECT COUNT(*) as c FROM memory_chunks').get().c).toBe(1);
    expect(ctx.getDb().prepare('SELECT COUNT(*) as c FROM facts').get().c).toBe(1);
  });
}
