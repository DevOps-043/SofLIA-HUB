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

  it('pide cobertura visual y graficas declarativas', () => {
    expect(PRESENTACIONES_SKILL_PROMPT).toContain('entre 40% y 60%');
    expect(PRESENTACIONES_SKILL_PROMPT).toContain('tipoGrafica: barras|lineas|area|radar|anillo');
    expect(PRESENTACIONES_SKILL_PROMPT).toContain('no conviertas cifras comparables en tarjetas o tablas');
    expect(PRESENTACIONES_SKILL_PROMPT).toContain('INICIO_MANIFIESTO_VISUALES_FUENTE_NO_CONFIABLE');
    expect(PRESENTACIONES_SKILL_PROMPT).toContain('nunca reemplaces una grafica o imagen documental real');
    expect(PRESENTACIONES_SKILL_PROMPT).toContain('workspace_generate_image');
  });

  it('respeta la paleta solicitada y evita repetir firmas visuales', () => {
    expect(PRESENTACIONES_SKILL_PROMPT).toContain('instruccion explicita del usuario > colores observados');
    expect(PRESENTACIONES_SKILL_PROMPT).toContain('meta.tema');
    expect(PRESENTACIONES_SKILL_PROMPT).toContain('tipo:variante');
    expect(PRESENTACIONES_SKILL_PROMPT).toContain('al menos cuatro variantes');
    expect(PRESENTACIONES_SKILL_PROMPT).toContain('no autoriza barras grises');
  });

  it('no deja marcadores de plantilla sin resolver', () => {
    expect(PRESENTACIONES_SKILL_PROMPT).not.toContain('${');
    expect(PRESENTACIONES_SKILL_PROMPT).not.toContain('undefined');
  });
});

