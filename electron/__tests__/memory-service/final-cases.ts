import { expect, it } from 'vitest';
import type { MemoryServiceTestContext } from './types';

export function registerMemoryFinalCases(ctx: MemoryServiceTestContext): void {
  it('MEM-019: latest summary query returns most recent summary', () => {
    const now = Date.now();
    ctx.getDb().prepare('INSERT INTO summaries (session_key, phone_number, period_start, period_end, summary_text, message_count) VALUES (?,?,?,?,?,?)')
      .run('test-session', '+52', now - 20000, now - 10000, 'Resumen viejo', 10);
    ctx.getDb().prepare('INSERT INTO summaries (session_key, phone_number, period_start, period_end, summary_text, message_count) VALUES (?,?,?,?,?,?)')
      .run('test-session', '+52', now - 10000, now, 'Resumen nuevo', 15);
    const row = ctx.getDb().prepare(
      'SELECT summary_text FROM summaries WHERE session_key = ? ORDER BY period_end DESC LIMIT 1',
    ).get('test-session');
    expect(row.summary_text).toBe('Resumen nuevo');
  });

  it('MEM-020: getFacts returns both phone-specific and global facts', () => {
    ctx.getDb().prepare('INSERT INTO facts (phone_number, category, fact_key, fact_value) VALUES (?,?,?,?)')
      .run('+5215551234567', 'personal', 'nombre', 'Juan');
    ctx.getDb().prepare('INSERT INTO facts (phone_number, category, fact_key, fact_value) VALUES (?,?,?,?)')
      .run(null, 'sistema', 'version', '2.0');
    const facts = ctx.getDb().prepare(
      'SELECT fact_key, fact_value, category FROM facts WHERE phone_number = ? OR phone_number IS NULL ORDER BY updated_at DESC LIMIT 50',
    ).all('+5215551234567');
    const keys = facts.map((fact: any) => fact.fact_key);
    expect(facts).toHaveLength(2);
    expect(keys).toContain('nombre');
    expect(keys).toContain('version');
  });
}
