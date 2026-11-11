import { describe, expect, it } from 'vitest';
import { DEFAULT_MODEL_ID, MODEL_OPTIONS } from '../../hooks/model-selector-options';
import { OPENAI_MODELS } from '../../config';

describe('Catálogo de modelos de SofLIA', () => {
  it('expone el catálogo conversacional y define gpt-6-luna como modelo por defecto', () => {
    expect(DEFAULT_MODEL_ID).toBe('gpt-6-luna');
    expect(MODEL_OPTIONS[0]).toMatchObject({ id: 'gpt-6-luna', name: 'SofLIA', provider: 'openai' });
    expect(MODEL_OPTIONS[1]).toMatchObject({ id: 'gpt-6.1-sol', name: 'SofLIA Max', provider: 'openai' });
    expect(MODEL_OPTIONS[2]).toMatchObject({
      id: 'gpt-6.1-terra', name: 'SofLIA Pro', provider: 'openai', defaultThinkingId: 'medium',
    });
    expect(MODEL_OPTIONS[2].badge).toBeUndefined();
    expect(MODEL_OPTIONS.map(({ id }) => id)).toEqual([
      'gpt-6-luna',
      'gpt-6.1-sol',
      'gpt-6.1-terra',
    ]);
    for (const option of MODEL_OPTIONS) {
      expect(option.thinkingOptions.map(({ level }) => level)).toEqual(['low', 'medium', 'high', 'xhigh', 'max']);
    }
    expect(MODEL_OPTIONS.flatMap(({ thinkingOptions }) => thinkingOptions.map(({ name }) => name)))
      .not.toContain('Rapido');
  });

  it('mantiene los identificadores del selector alineados con el ruteo OpenAI', () => {
    expect(MODEL_OPTIONS.find(({ name }) => name === 'SofLIA Max')?.id).toBe(OPENAI_MODELS.COMPUTER_USE);
    expect(MODEL_OPTIONS.find(({ name }) => name === 'SofLIA')?.id).toBe(OPENAI_MODELS.COMMANDS);
  });
});
