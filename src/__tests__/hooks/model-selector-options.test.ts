import { describe, expect, it } from 'vitest';
import { DEFAULT_MODEL_ID, MODEL_OPTIONS } from '../../hooks/model-selector-options';
import { SOFLIA_LITE_MODEL, SOFLIA_RUNTIME_MODEL } from '../../shared/soflia-runtime-model';

describe('Catálogo de modelos de SofLIA', () => {
  it('expone el catálogo conversacional y mantiene el modelo del runtime por defecto', () => {
    expect(DEFAULT_MODEL_ID).toBe(SOFLIA_RUNTIME_MODEL);
    expect(MODEL_OPTIONS).toHaveLength(4);
    expect(MODEL_OPTIONS[0]).toMatchObject({ id: SOFLIA_RUNTIME_MODEL, name: 'SofLIA' });
    expect(MODEL_OPTIONS.map(({ id }) => id)).toEqual([
      SOFLIA_RUNTIME_MODEL,
      'gpt-5.6-terra',
      'gpt-5.6-luna',
      SOFLIA_LITE_MODEL,
    ]);
    expect(MODEL_OPTIONS.map(({ provider }) => provider)).toEqual(['google', 'openai', 'openai', 'google']);
    expect(MODEL_OPTIONS[0].thinkingOptions.map(({ level }) => level)).toEqual(['low', 'medium', 'high']);
    expect(MODEL_OPTIONS[1].thinkingOptions.map(({ level }) => level)).toEqual(['low', 'medium', 'high', 'xhigh', 'max']);
    expect(MODEL_OPTIONS.flatMap(({ thinkingOptions }) => thinkingOptions.map(({ name }) => name)))
      .not.toContain('Rapido');
  });
});
