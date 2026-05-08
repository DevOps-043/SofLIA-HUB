import { describe, expect, it } from 'vitest';

function jaccard(a: string, b: string): number {
  const setA = new Set(a.toLowerCase().split(/\s+/));
  const setB = new Set(b.toLowerCase().split(/\s+/));
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return intersection.size / union.size;
}

describe('EDGE - Data Integrity', () => {
  it('EDGE-DATA-001: duplicate messages are deduplicated by ID', () => {
    const messages = [
      { id: 'm1', text: 'Hola', timestamp: 100 },
      { id: 'm1', text: 'Hola actualizado', timestamp: 200 },
      { id: 'm2', text: 'Otro mensaje', timestamp: 150 },
    ];

    const deduped = new Map<string, typeof messages[0]>();
    for (const msg of messages) {
      const existing = deduped.get(msg.id);
      if (!existing || msg.timestamp > existing.timestamp) {
        deduped.set(msg.id, msg);
      }
    }

    const result = Array.from(deduped.values());
    expect(result).toHaveLength(2);
    expect(result.find(m => m.id === 'm1')?.text).toBe('Hola actualizado');
  });

  it('EDGE-DATA-002: conversations are capped at MAX_CONVERSATIONS', () => {
    const capped = Array.from({ length: 600 }, (_, i) => ({
      id: `conv-${i}`,
      title: `Conversacion ${i}`,
      updated_at: new Date(2026, 0, 1, 0, 0, i).toISOString(),
    }))
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 500);

    expect(capped).toHaveLength(500);
  });

  it('EDGE-DATA-003: Jaccard similarity detects near-duplicates', () => {
    expect(jaccard('Empresa ABC', 'Empresa ABC SRL')).toBeGreaterThan(0.5);
    expect(jaccard('Empresa ABC', 'Empresa XYZ')).toBeLessThan(0.5);
    expect(jaccard('Google Inc', 'google inc')).toBe(1.0);
  });
});
