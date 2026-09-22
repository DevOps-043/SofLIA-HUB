import { describe, expect, it } from 'vitest';
import { DEFAULT_MODEL_ID, MODEL_OPTIONS } from '../../hooks/model-selector-options';
import { SOFLIA_RUNTIME_MODEL } from '../../shared/soflia-runtime-model';

describe('Catálogo de modelos de SofLIA', () => {
  it('expone el catálogo conversacional y define gpt-6-luna como modelo por defecto', () => {
    expect(DEFAULT_MODEL_ID).toBe('gpt-6-luna');
    expect(MODEL_OPTIONS).toHaveLength(3);
    expect(MODEL_OPTIONS[0]).toMatchObject({ id: 'gpt-6-luna', name: 'SofLIA', provider: 'openai' });
    expect(MODEL_OPTIONS[1]).toMatchObject({ id: 'gpt-6-sol', name: 'SofLIA Max', provider: 'openai' });
    expect(MODEL_OPTIONS[2]).toMatchObject({ id: SOFLIA_RUNTIME_MODEL, name: 'SofLIA Pro', provider: 'google' });
    expect(MODEL_OPTIONS.map(({ id }) => id)).toEqual([
      'gpt-6-luna',
      'gpt-6-sol',
      SOFLIA_RUNTIME_MODEL,
    ]);
    expect(MODEL_OPTIONS.map(({ provider }) => provider)).toEqual(['openai', 'openai', 'google']);
    expect(MODEL_OPTIONS[0].thinkingOptions.map(({ level }) => level)).toEqual(['low', 'medium', 'high', 'xhigh', 'max']);
    expect(MODEL_OPTIONS[1].thinkingOptions.map(({ level }) => level)).toEqual(['low', 'medium', 'high', 'xhigh', 'max']);
    expect(MODEL_OPTIONS[2].thinkingOptions.map(({ level }) => level)).toEqual(['low', 'medium', 'high']);
    expect(MODEL_OPTIONS.flatMap(({ thinkingOptions }) => thinkingOptions.map(({ name }) => name)))
      .not.toContain('Rapido');
  });
});
