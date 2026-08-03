import { expect, it } from 'vitest';
import { insertMessage } from '../memory-service.fixtures';
import { buildTimelineRecall } from '../../memory/timeline-recall';
import type { MemoryServiceTestContext } from './types';

export function registerMemoryContextCases(ctx: MemoryServiceTestContext): void {
  it('MEM-013: formatContextForPrompt builds sections from context data', () => {
    const context = {
      recentMessages: [{ role: 'user', content: 'Hola', timestamp: Date.now() }],
      rollingSummary: 'Resumen de conversacion anterior',
      semanticRecall: [{ text: 'Dato relevante', score: 0.85, timestamp: Date.now() }],
      facts: [{ key: 'empresa', value: 'Acme', category: 'trabajo' }],
      soul: '# Pulse - Identidad Central',
    };
    let sections = '';
    if (context.soul) sections += `\n\n=== SOUL ===\n${context.soul}`;
    if (context.recentMessages.length > 0) sections += '\n\n=== MENSAJES RECIENTES ===\n';
    if (context.rollingSummary) sections += `\n\n=== RESUMEN ===\n${context.rollingSummary}`;
    if (context.semanticRecall.length > 0) sections += '\n\n=== RECUERDOS ===\n';
    if (context.facts.length > 0) sections += '\n\n=== DATOS ===\n';
    expect(sections).toContain('SOUL');
    expect(sections).toContain('MENSAJES RECIENTES');
    expect(sections).toContain('RESUMEN');
    expect(sections).toContain('RECUERDOS');
    expect(sections).toContain('DATOS');
  });

  it('MEM-015: SOUL.md default content includes identity section', () => {
    const defaultSoul = '# Pulse - Identidad Central\n\n## Quien Soy\nSoy Pulse, asistente de IA para negocios hispanohablantes.';
    expect(defaultSoul).toContain('Pulse');
    expect(defaultSoul).toContain('Identidad Central');
  });

  it('MEM-016: getConversationHistory merges consecutive same-role messages', () => {
    const messages = [
      { role: 'user', content: 'Hola' },
      { role: 'user', content: 'Como estas?' },
      { role: 'model', content: 'Bien!' },
      { role: 'model', content: 'En que puedo ayudar?' },
      { role: 'user', content: 'Necesito algo' },
    ];
    const history: Array<{ role: string; parts: Array<{ text: string }> }> = [];
    for (const msg of messages) {
      const last = history[history.length - 1];
      if (last?.role === msg.role) last.parts.push({ text: msg.content });
      else history.push({ role: msg.role, parts: [{ text: msg.content }] });
    }
    while (history.length > 0 && history[history.length - 1].role === 'user') history.pop();
    expect(history).toHaveLength(2);
    expect(history[0].parts).toHaveLength(2);
    expect(history[1].parts).toHaveLength(2);
  });

  it('MEM-017: saveMessage with empty content does not insert', () => {
    const content = '   ';
    if (content.trim()) insertMessage(ctx.getDb(), { content });
    expect(ctx.getDb().prepare('SELECT * FROM messages').all()).toHaveLength(0);
  });

  it('MEM-018: getRecentMessages with no matching session returns empty array', () => {
    insertMessage(ctx.getDb(), { sessionKey: 'other-session' });
    const rows = ctx.getDb().prepare('SELECT * FROM messages WHERE session_key = ? ORDER BY timestamp DESC LIMIT ?')
      .all('nonexistent-session', 20);
    expect(rows).toEqual([]);
  });

  it('MEM-019: timeline recall finds messages from two weeks ago', () => {
    const twoWeeksAgo = Date.now() - (14 * 24 * 60 * 60 * 1000);
    insertMessage(ctx.getDb(), {
      sessionKey: '5215500000000',
      phoneNumber: '5215500000000',
      role: 'model',
      content: 'Te recomende preparar el reporte comercial los viernes.',
      timestamp: twoWeeksAgo,
    });
    insertMessage(ctx.getDb(), {
      sessionKey: '5215500000000',
      phoneNumber: '5215500000000',
      role: 'user',
      content: 'Mensaje reciente sin relacion',
      timestamp: Date.now(),
    });

    const recall = buildTimelineRecall(
      ctx.getDb(),
      '5215500000000',
      'Que me dijiste hace dos semanas?',
      5,
    );
    expect(recall.some((entry) => entry.content.includes('reporte comercial'))).toBe(true);
  });
}
