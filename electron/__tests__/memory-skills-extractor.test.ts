import { describe, expect, it } from 'vitest';
import { parseSkillsResponse } from '../memory/skills-extractor';

describe('parseSkillsResponse', () => {
  it('SK-001: parsea skills válidas con tipos permitidos', () => {
    const raw = JSON.stringify([
      { type: 'preferencia', title: 'informes', content: 'bullets + fuentes', triggerContext: 'al pedir informe' },
      { type: 'correccion', title: 'no-inventar', content: 'si falta info, decirlo' },
    ]);
    const skills = parseSkillsResponse(raw);
    expect(skills).toHaveLength(2);
    expect(skills[0]).toEqual({ type: 'preferencia', title: 'informes', content: 'bullets + fuentes', triggerContext: 'al pedir informe' });
    expect(skills[1]).toEqual({ type: 'correccion', title: 'no-inventar', content: 'si falta info, decirlo' });
  });

  it('SK-002: descarta tipos inválidos y entradas incompletas', () => {
    const raw = JSON.stringify([
      { type: 'inventado', title: 'x', content: 'y' },
      { type: 'preferencia', title: '', content: 'sin titulo' },
      { type: 'preferencia', title: 'sin-content' },
      { type: 'contexto_trabajo', title: 'rol', content: 'Es líder de DevOps' },
    ]);
    const skills = parseSkillsResponse(raw);
    expect(skills).toHaveLength(1);
    expect(skills[0].title).toBe('rol');
  });

  it('SK-003: acepta alias de campos (skill_type / value / trigger_context)', () => {
    const raw = JSON.stringify([{ skill_type: 'procedimiento', title: 'deploy', value: 'usar el script X', trigger_context: 'al desplegar' }]);
    const skills = parseSkillsResponse(raw);
    expect(skills[0]).toEqual({ type: 'procedimiento', title: 'deploy', content: 'usar el script X', triggerContext: 'al desplegar' });
  });

  it('SK-004: tolera fence de código markdown y JSON inválido', () => {
    expect(parseSkillsResponse('```json\n[{"type":"preferencia","title":"t","content":"c"}]\n```')).toHaveLength(1);
    expect(parseSkillsResponse('esto no es json')).toEqual([]);
    expect(parseSkillsResponse('{}')).toEqual([]);
  });

  it('SK-005: respeta el tope de skills por sesión (máx 6)', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ type: 'preferencia', title: `t${i}`, content: `c${i}` }));
    expect(parseSkillsResponse(JSON.stringify(many))).toHaveLength(6);
  });

  it('SK-006: trunca título/contenido largos', () => {
    const raw = JSON.stringify([{ type: 'preferencia', title: 'a'.repeat(200), content: 'b'.repeat(1000) }]);
    const [skill] = parseSkillsResponse(raw);
    expect(skill.title.length).toBe(80);
    expect(skill.content.length).toBe(400);
  });
});
