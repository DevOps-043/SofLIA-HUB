import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from './memory-service.fixtures';
import { purgeTruncatedSummaries } from '../memory/initializer';

const CARD = [
  '# Memory Card',
  '## Temas',
  '- Presentaciones ejecutivas de 9 a 12 diapositivas con portada de imagen.',
  '- El usuario corrige las entregas en texto plano: exige HTML con marca.',
  '## Compromisos',
  '- Revisar el deck de Okra antes del viernes.',
].join('\n');

function insertSummary(db: any, opts: { sessionKey: string; text: string; start: number; end: number }) {
  db.prepare(`
    INSERT INTO summaries (session_key, phone_number, period_start, period_end, summary_text, message_count)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(opts.sessionKey, opts.sessionKey, opts.start, opts.end, opts.text, 15);
}

function insertSummaryChunk(db: any, opts: { sessionKey: string; text: string; start: number; end: number }) {
  db.prepare(`
    INSERT INTO memory_chunks (session_key, phone_number, chunk_text, embedding, source_type, source_start_time, source_end_time)
    VALUES (?, ?, ?, ?, 'summary', ?, ?)
  `).run(opts.sessionKey, opts.sessionKey, opts.text, '[0.1,0.2]', opts.start, opts.end);
}

describe('purgeTruncatedSummaries', () => {
  let db: any;

  beforeEach(() => {
    db = createTestDb();
  });

  it('MP-001: borra el resumen truncado y su chunk derivado, conserva el completo', () => {
    insertSummary(db, { sessionKey: 'chat:user:u1', text: '# Memory Card\n\n**Fecha:** 8 de', start: 100, end: 200 });
    insertSummaryChunk(db, { sessionKey: 'chat:user:u1', text: '# Memory Card\n\n**Fecha:** 8 de', start: 100, end: 200 });
    insertSummary(db, { sessionKey: 'chat:user:u1', text: CARD, start: 300, end: 400 });
    insertSummaryChunk(db, { sessionKey: 'chat:user:u1', text: CARD, start: 300, end: 400 });

    purgeTruncatedSummaries(db);

    const summaries = db.prepare('SELECT summary_text FROM summaries').all();
    expect(summaries).toHaveLength(1);
    expect(summaries[0].summary_text).toBe(CARD);
    const chunks = db.prepare('SELECT source_start_time FROM memory_chunks').all();
    expect(chunks).toHaveLength(1);
    expect(chunks[0].source_start_time).toBe(300);
  });

  it('MP-002: no toca los chunks de conversación aunque su resumen se borre', () => {
    insertSummary(db, { sessionKey: 'chat:user:u1', text: 'fragmento', start: 100, end: 200 });
    db.prepare(`
      INSERT INTO memory_chunks (session_key, phone_number, chunk_text, embedding, source_type, source_start_time, source_end_time)
      VALUES ('chat:user:u1', 'chat:user:u1', 'turno del usuario', '[0.1]', 'conversation', 100, 200)
    `).run();

    purgeTruncatedSummaries(db);

    expect(db.prepare('SELECT COUNT(*) AS total FROM summaries').get().total).toBe(0);
    expect(db.prepare("SELECT COUNT(*) AS total FROM memory_chunks WHERE source_type = 'conversation'").get().total).toBe(1);
  });

  it('MP-003: es idempotente y no toca una base ya sana', () => {
    insertSummary(db, { sessionKey: 'chat:user:u1', text: CARD, start: 300, end: 400 });

    purgeTruncatedSummaries(db);
    purgeTruncatedSummaries(db);

    expect(db.prepare('SELECT COUNT(*) AS total FROM summaries').get().total).toBe(1);
  });
});
