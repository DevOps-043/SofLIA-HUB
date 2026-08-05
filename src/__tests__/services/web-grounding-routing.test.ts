import { describe, expect, it } from 'vitest';
import { resolveGroundingModelIds } from '../../services/gemini-chat/web-grounding';

describe('web grounding: conservación del modelo orquestador', () => {
  it('WGR-001: intenta primero el modelo Gemini seleccionado por el usuario', () => {
    const selectedModel = 'gemini-selected-by-user';

    const candidates = resolveGroundingModelIds([selectedModel]);

    expect(candidates[0]).toBe(selectedModel);
    expect(new Set(candidates).size).toBe(candidates.length);
  });
});
