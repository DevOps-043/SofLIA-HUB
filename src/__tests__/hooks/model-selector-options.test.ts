import { describe, expect, it } from 'vitest';
import { DEFAULT_MODEL_ID, MODEL_OPTIONS } from '../../hooks/model-selector-options';

describe('Catálogo de modelos de SofLIA', () => {
  it('expone el catálogo conversacional y mantiene Gemini 3.6 Flash por defecto', () => {
    expect(DEFAULT_MODEL_ID).toBe('gemini-3.6-flash');
    expect(MODEL_OPTIONS).toHaveLength(4);
    expect(MODEL_OPTIONS[0]).toMatchObject({ id: 'gemini-3.6-flash', name: 'SofLIA' });
    expect(MODEL_OPTIONS.map(({ id }) => id)).toEqual([
      'gemini-3.6-flash',
      'gpt-5.6-terra',
      'gpt-5.6-luna',
      'gemini-3.5-flash-lite',
    ]);
    expect(MODEL_OPTIONS.map(({ provider }) => provider)).toEqual(['google', 'openai', 'openai', 'google']);
    expect(MODEL_OPTIONS[0].thinkingOptions.map(({ level }) => level)).toEqual(['low', 'medium', 'high']);
    expect(MODEL_OPTIONS[1].thinkingOptions.map(({ level }) => level)).toEqual(['low', 'medium', 'high', 'xhigh', 'max']);
    expect(MODEL_OPTIONS.flatMap(({ thinkingOptions }) => thinkingOptions.map(({ name }) => name)))
      .not.toContain('Rapido');
  });
});
