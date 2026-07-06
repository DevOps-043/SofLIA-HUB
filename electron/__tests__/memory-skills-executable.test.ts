import { describe, expect, it, vi } from 'vitest';
import {
  buildRecipeProposal,
  matchExecutableSkill,
  parseRecipe,
  runExecutableSkill,
  serializeRecipe,
} from '../memory/skills-executable';
import type { Skill } from '../memory/skills-types';

function execSkill(over: Partial<Skill> = {}): Skill {
  return {
    id: 1, ownerKey: 'user:u1', type: 'procedimiento_ejecutable',
    title: 'informe semanal de ventas', content: serializeRecipe({ summary: 'Arma y envía el informe', templateId: 'custom_abc' }),
    triggerContext: 'cuando pide el reporte semanal de ventas', confidence: 0.7, usageCount: 2, lastUsedAt: null, source: 'manual',
    ...over,
  };
}

describe('Serialización de recetas', () => {
  it('SE-001: serialize/parse ida y vuelta', () => {
    const recipe = { summary: 'Hace X', templateId: 'custom_1' };
    expect(parseRecipe(serializeRecipe(recipe))).toEqual(recipe);
  });
  it('SE-002: parse tolera JSON inválido o vacío', () => {
    expect(parseRecipe('no-json')).toBeNull();
    expect(parseRecipe('{}')).toBeNull();
    expect(parseRecipe(serializeRecipe({ summary: 'X' }))).toEqual({ summary: 'X', templateId: undefined });
  });
});

describe('Matching de skills ejecutables', () => {
  it('SE-010: matchea por solapamiento con título/contexto', () => {
    const skills = [execSkill()];
    const m = matchExecutableSkill('generame el informe semanal de ventas por favor', skills);
    expect(m?.skill.id).toBe(1);
    expect(m!.score).toBeGreaterThan(0.3);
  });
  it('SE-011: no matchea peticiones no relacionadas', () => {
    expect(matchExecutableSkill('qué hora es en Tokio', [execSkill()])).toBeNull();
  });
  it('SE-012: ignora skills que no son ejecutables', () => {
    const noExec = execSkill({ type: 'preferencia' });
    expect(matchExecutableSkill('informe semanal de ventas', [noExec])).toBeNull();
  });
  it('SE-013: elige la de mayor score entre varias', () => {
    const a = execSkill({ id: 1, title: 'informe de ventas', triggerContext: 'ventas' });
    const b = execSkill({ id: 2, title: 'informe semanal de ventas mensual detallado', triggerContext: 'informe semanal ventas mensual' });
    const m = matchExecutableSkill('quiero el informe semanal de ventas mensual', [a, b]);
    expect(m?.skill.id).toBe(2);
  });
});

describe('Propuesta y ejecución (HITL)', () => {
  it('SE-020: la propuesta pide confirmación explícita', () => {
    const skill = execSkill();
    const text = buildRecipeProposal(skill, { summary: 'Arma y envía el informe' });
    expect(text).toContain('informe semanal de ventas');
    expect(text).toContain('confirmación');
  });

  it('SE-021: runExecutableSkill delega al motor HITL con el templateId', async () => {
    const executeCustomTemplate = vi.fn(async () => ({ needsApproval: true }));
    const result = await runExecutableSkill({ executeCustomTemplate }, execSkill(), 'informe semanal');
    expect(executeCustomTemplate).toHaveBeenCalledWith({ templateId: 'custom_abc', input: { request: 'informe semanal' } });
    expect(result).toEqual({ ok: true, run: { needsApproval: true } });
  });

  it('SE-022: sin templateId no ejecuta nada y explica', async () => {
    const executeCustomTemplate = vi.fn();
    const skill = execSkill({ content: serializeRecipe({ summary: 'solo descripción' }) });
    const result = await runExecutableSkill({ executeCustomTemplate }, skill, 'x');
    expect(executeCustomTemplate).not.toHaveBeenCalled();
    expect(result).toMatchObject({ ok: false });
  });
});
