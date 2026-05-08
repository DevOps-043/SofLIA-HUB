import { expect, it } from 'vitest';
import { CHARS_PER_TOKEN, SEMANTIC_MIN_SCORE } from '../memory-service.schema';
import { cosineSimilarity, truncateToTokens } from '../memory-service.fixtures';

export function registerMemorySemanticCases(): void {
  it('MEM-008: semantic search filters results below MIN_SCORE', () => {
    const queryVec = [1, 0, 0, 0, 0];
    const candidates = [
      { text: 'alto', embedding: [0.9, 0.1, 0, 0, 0] },
      { text: 'bajo', embedding: [0, 0, 0, 1, 0] },
      { text: 'medio', embedding: [0.5, 0.5, 0, 0, 0] },
    ];
    const scores = candidates.map((item) => ({
      text: item.text,
      score: cosineSimilarity(queryVec, item.embedding),
    }));
    const filtered = scores.filter((item) => item.score >= SEMANTIC_MIN_SCORE);
    expect(filtered.length).toBeGreaterThanOrEqual(1);
    expect(filtered.every((item) => item.score >= SEMANTIC_MIN_SCORE)).toBe(true);
    expect(filtered.find((item) => item.text === 'bajo')).toBeUndefined();
  });

  it('MEM-009: truncateToTokens respects token budget', () => {
    const budget = 2000;
    const maxChars = budget * CHARS_PER_TOKEN;
    expect(truncateToTokens('Hola mundo', budget)).toBe('Hola mundo');
    const truncated = truncateToTokens('A'.repeat(maxChars + 100), budget);
    expect(truncated.length).toBe(maxChars + 3);
    expect(truncated.endsWith('...')).toBe(true);
  });

  it('MEM-014: cosineSimilarity returns correct values', () => {
    expect(cosineSimilarity([1, 0, 0], [1, 0, 0])).toBeCloseTo(1.0);
    expect(cosineSimilarity([1, 0, 0], [0, 1, 0])).toBeCloseTo(0.0);
    expect(cosineSimilarity([1, 0, 0], [-1, 0, 0])).toBeCloseTo(-1.0);
    expect(cosineSimilarity([0, 0, 0], [1, 0, 0])).toBe(0);
    const score = cosineSimilarity([1, 1, 0], [1, 0, 0]);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(1);
  });
}
