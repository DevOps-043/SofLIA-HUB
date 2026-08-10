import { findSystemSkill, systemSkillsForSurface } from '../../../src/shared/skills/registry';
import type { SystemSkill } from '../../../src/shared/skills/types';

/**
 * Catalogo de Skills en WhatsApp.
 *
 * Solo se ofrecen Skills del SISTEMA habilitadas para esta superficie: las del
 * usuario viven en su sesion del Hub y no se resuelven desde el canal. Las
 * guardas de WhatsApp se aplican encima del catalogo, nunca al reves.
 */

export type SkillAvailability =
  | { ok: true; skill: SystemSkill }
  | { ok: false; message: string };

/** Skills invocables en WhatsApp para el contexto dado. */
export function availableWhatsAppSkills(isGroup: boolean): SystemSkill[] {
  return whatsAppSkills().filter((skill) => !(isGroup && skill.blockedInGroups));
}

/**
 * Main lee el entorno REAL en cada llamada. No se cachea ni se resuelve en
 * tiempo de build: la bandera es el mecanismo de rollback y debe poder
 * cambiarse sin reconstruir la aplicacion.
 */
function whatsAppSkills(): SystemSkill[] {
  return systemSkillsForSurface('whatsapp', process.env);
}

/**
 * Resuelve si una Skill puede ejecutarse aqui. Distingue los tres motivos de
 * rechazo para que el usuario sepa que hacer en cada caso.
 */
export function resolveWhatsAppSkill(skillId: string, isGroup: boolean): SkillAvailability {
  const skill = findSystemSkill(skillId);
  if (!skill) {
    return { ok: false, message: 'No conozco esa skill.' };
  }

  if (!whatsAppSkills().some((entry) => entry.id === skill.id)) {
    const superficies = skill.surfaces.includes('chat') ? 'el chat del Hub' : 'otra superficie';
    return { ok: false, message: `La skill "${skill.name}" no esta disponible por WhatsApp. Puedes usarla desde ${superficies}.` };
  }

  if (isGroup && skill.blockedInGroups) {
    return { ok: false, message: `La skill "${skill.name}" no se ejecuta en grupos: su resultado quedaria visible para todos los miembros. Escribeme por privado.` };
  }

  return { ok: true, skill };
}

/** Texto del comando `/skills`. */
export function buildSkillsCommandText(isGroup: boolean): string {
  const skills = availableWhatsAppSkills(isGroup);
  if (skills.length === 0) {
    return isGroup
      ? 'No hay skills disponibles en grupos. Escribeme por privado para usarlas.'
      : 'No hay skills disponibles por WhatsApp en este momento.';
  }

  const lineas = skills.map((skill) => `- *${skill.name}*: ${skill.description ?? 'Sin descripcion.'}`);
  return ['*Skills disponibles por WhatsApp*', '', ...lineas].join('\n');
}
