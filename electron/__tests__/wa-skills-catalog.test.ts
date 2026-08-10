import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  availableWhatsAppSkills,
  buildSkillsCommandText,
  resolveWhatsAppSkill,
} from '../wa-agent/chat-commands/skills';
import { systemSkillsForSurface } from '../../src/shared/skills/registry';
import { PRESENTACIONES_SKILL_ID } from '../../src/shared/skills/presentaciones-skill';

/**
 * El catalogo de Skills en WhatsApp debe respetar las guardas de la
 * superficie: una Skill no habilitada aqui no se ejecuta, y una bloqueada en
 * grupos no puede invocarse desde una conversacion de grupo.
 */
describe('catalogo de skills en WhatsApp', () => {
  const originalFlag = process.env.VITE_SKILL_PRESENTACIONES_ENABLED;

  beforeEach(() => {
    process.env.VITE_SKILL_PRESENTACIONES_ENABLED = 'true';
  });

  afterEach(() => {
    if (originalFlag === undefined) delete process.env.VITE_SKILL_PRESENTACIONES_ENABLED;
    else process.env.VITE_SKILL_PRESENTACIONES_ENABLED = originalFlag;
  });

  it('ofrece las skills habilitadas para la superficie en conversacion individual', () => {
    const skills = availableWhatsAppSkills(false);

    expect(skills.map((skill) => skill.id)).toContain(PRESENTACIONES_SKILL_ID);
  });

  it('oculta en grupos las skills bloqueadas para grupos', () => {
    const skills = availableWhatsAppSkills(true);

    expect(skills.map((skill) => skill.id)).not.toContain(PRESENTACIONES_SKILL_ID);
  });

  it('permite ejecutar la skill por privado', () => {
    const result = resolveWhatsAppSkill(PRESENTACIONES_SKILL_ID, false);

    expect(result.ok).toBe(true);
  });

  it('rechaza la skill en un grupo explicando el motivo', () => {
    const result = resolveWhatsAppSkill(PRESENTACIONES_SKILL_ID, true);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain('grupos');
      // El rechazo no debe filtrar contenido de la conversacion individual.
      expect(result.message).not.toContain('@s.whatsapp.net');
    }
  });

  it('rechaza una skill desconocida', () => {
    const result = resolveWhatsAppSkill('sistema:inexistente', false);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain('No conozco');
  });

  it('rechaza una skill deshabilitada por bandera e indica donde usarla', () => {
    process.env.VITE_SKILL_PRESENTACIONES_ENABLED = 'false';

    const result = resolveWhatsAppSkill(PRESENTACIONES_SKILL_ID, false);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain('no esta disponible por WhatsApp');
  });

  it('el comando /skills lista las disponibles', () => {
    const texto = buildSkillsCommandText(false);

    expect(texto).toContain('Presentaciones');
  });

  it('el comando /skills en grupo explica que no hay ninguna', () => {
    const texto = buildSkillsCommandText(true);

    expect(texto).toContain('privado');
  });

  /**
   * La bandera es el mecanismo de rollback: debe leerse del entorno REAL en
   * cada llamada. Una version anterior resolvia el entorno una sola vez desde
   * `import.meta.env`, lo que congelaba el valor en tiempo de build (y ademas
   * hacia que el bundler inlinera el entorno completo en un chunk de main).
   */
  it('la bandera se relee del entorno en cada consulta', () => {
    expect(availableWhatsAppSkills(false)).not.toHaveLength(0);

    delete process.env.VITE_SKILL_PRESENTACIONES_ENABLED;

    expect(availableWhatsAppSkills(false)).toHaveLength(0);
  });

  it('el registro no habilita nada cuando no recibe entorno', () => {
    // Sin entorno explicito, una skill con bandera queda apagada: el valor
    // por defecto nunca expone una capacidad sin declararla.
    expect(systemSkillsForSurface('whatsapp')).toHaveLength(0);
    expect(systemSkillsForSurface('chat')).toHaveLength(0);
  });
});
