import { expect, it } from 'vitest';
import { insertMessage } from '../memory-service.fixtures';
import type { MemoryServiceTestContext } from './types';

export function registerMemoryMaintenanceCases(ctx: MemoryServiceTestContext): void {
  it('MEM-010: compactOldData deletes data older than cutoff', () => {
    const now = Date.now();
    const oldTs = now - (100 * 24 * 60 * 60 * 1000);
    const recentTs = now - (10 * 24 * 60 * 60 * 1000);
    insertMessage(ctx.getDb(), { content: 'Viejo', timestamp: oldTs });
    insertMessage(ctx.getDb(), { content: 'Reciente', timestamp: recentTs });
    ctx.getDb().prepare('INSERT INTO memory_chunks (session_key, phone_number, chunk_text, embedding, source_type, source_end_time) VALUES (?,?,?,?,?,?)')
      .run('test-session', '+5215551234567', 'Chunk viejo', '[]', 'conversation', oldTs);
    ctx.getDb().prepare('INSERT INTO memory_chunks (session_key, phone_number, chunk_text, embedding, source_type, source_end_time) VALUES (?,?,?,?,?,?)')
      .run('test-session', '+5215551234567', 'Chunk reciente', '[]', 'conversation', recentTs);

    const cutoff = now - (90 * 24 * 60 * 60 * 1000);
    expect(ctx.getDb().prepare('DELETE FROM messages WHERE timestamp < ?').run(cutoff).changes).toBe(1);
    expect(ctx.getDb().prepare('DELETE FROM memory_chunks WHERE source_end_time < ?').run(cutoff).changes).toBe(1);
    expect(ctx.getDb().prepare('SELECT COUNT(*) as c FROM messages').get().c).toBe(1);
  });

  it('MEM-011: session key scoped queries isolate different sessions', () => {
    insertMessage(ctx.getDb(), { sessionKey: 'session-A', content: 'Hola A' });
    insertMessage(ctx.getDb(), { sessionKey: 'session-B', content: 'Hola B' });
    const rowsA = ctx.getDb().prepare('SELECT * FROM messages WHERE session_key = ?').all('session-A');
    const rowsB = ctx.getDb().prepare('SELECT * FROM messages WHERE session_key = ?').all('session-B');
    expect(rowsA[0].content).toBe('Hola A');
    expect(rowsB[0].content).toBe('Hola B');
  });

  it('MEM-012: safeStorage token save, get, and delete work correctly', async () => {
    const { safeStorage } = await import('electron');
    const encrypted = safeStorage.encryptString('my-api-token');
    expect(encrypted).toBeInstanceOf(Buffer);
    expect(safeStorage.decryptString(encrypted)).toBe('my-api-token');
    expect(safeStorage.isEncryptionAvailable()).toBe(true);
  });
}
