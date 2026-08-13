import { describe, expect, it } from 'vitest';
import { PRESENTACIONES_SKILL_PROMPT } from '../../prompts/skills/presentaciones';

describe('contrato React de la Skill de presentaciones', () => {
  it('delega geometria y animacion al runtime, no al modelo', () => {
    expect(PRESENTACIONES_SKILL_PROMPT).toContain('React, Tailwind y Framer Motion');
    expect(PRESENTACIONES_SKILL_PROMPT).toContain('NO escribes HTML, CSS, JavaScript, JSX');
    expect(PRESENTACIONES_SKILL_PROMPT).toContain('deck.json');
  });

  it('fusiona HyperFrames mediante un vocabulario seguro', () => {
    expect(PRESENTACIONES_SKILL_PROMPT).toContain('HyperFrames como doctrina creativa');
    expect(PRESENTACIONES_SKILL_PROMPT).toContain('movimiento maestro');
    expect(PRESENTACIONES_SKILL_PROMPT).toContain('corte|empuje|zoom|flujo');
    expect(PRESENTACIONES_SKILL_PROMPT).toContain('ascenso|revelado|foco|trazo');
  });

  it('impone limites de densidad que evitan texto ilegible', () => {
    expect(PRESENTACIONES_SKILL_PROMPT).toContain('titulo 118 caracteres');
    expect(PRESENTACIONES_SKILL_PROMPT).toContain('Una diapositiva comunica una idea');
    expect(PRESENTACIONES_SKILL_PROMPT).toContain('nunca achiques texto');
  });

  it('mantiene fuentes, assets locales y verificacion honesta', () => {
    expect(PRESENTACIONES_SKILL_PROMPT).toContain('No inventes datos');
    expect(PRESENTACIONES_SKILL_PROMPT).toContain('assets/');
    expect(PRESENTACIONES_SKILL_PROMPT).toContain('No afirmes una verificacion visual que no observaste');
    expect(PRESENTACIONES_SKILL_PROMPT).toContain('Nunca escribas rutas absolutas');
  });

  it('no deja marcadores de plantilla sin resolver', () => {
    expect(PRESENTACIONES_SKILL_PROMPT).not.toContain('${');
    expect(PRESENTACIONES_SKILL_PROMPT).not.toContain('undefined');
  });
});
