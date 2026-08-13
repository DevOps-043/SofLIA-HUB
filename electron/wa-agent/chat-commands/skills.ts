import { systemSkillsFor } from '../../skill-catalog/system-skills-store';
import type { SystemSkill } from '../../../src/shared/skills/types';

/**
 * Catalogo de Skills en WhatsApp.
 *
 * Solo se ofrecen Skills del SISTEMA habilitadas para esta superficie: las del
 * usuario viven en su sesion del Hub y no se resuelven desde el canal. Las
 * guardas de WhatsApp se aplican encima del catalogo, nunca al reves.
 *
 * El catalogo sale de `public.system_skills` con respaldo en la version
 * instalada, igual que en el chat del Hub: leer de sitios distintos dejaria una
 * Skill retirada viva en una de las dos superficies.
 */

export type SkillAvailability =
  | { ok: true; skill: SystemSkill }
  | { ok: false; message: string };

/** Skills invocables en WhatsApp para el contexto dado. */
export async function availableWhatsAppSkills(isGroup: boolean): Promise<SystemSkill[]> {
  const skills = await systemSkillsFor('whatsapp');
  return skills.filter((skill) => !(isGroup && skill.blockedInGroups));
}

/**
 * Resuelve si una Skill puede ejecutarse aqui. Distingue los motivos de rechazo
 * para que el usuario sepa que hacer en cada caso: no existe, existe pero no en
 * esta superficie, o esta bloqueada en grupos.
 */
export async function resolveWhatsAppSkill(skillId: string, isGroup: boolean): Promise<SkillAvailability> {
  const enWhatsApp = await systemSkillsFor('whatsapp');
  const skill = enWhatsApp.find((entry) => entry.id === skillId);

  if (!skill) {
    // Se consulta el chat para separar "aqui no" de "en ninguna parte": el
    // catalogo pudo retirarla entera, y decirle al usuario que la use en el Hub
    // seria mandarlo a un sitio donde tampoco esta.
    const enChat = await systemSkillsFor('chat');
    const enOtraSuperficie = enChat.find((entry) => entry.id === skillId);
    if (!enOtraSuperficie) {
      return { ok: false, message: 'No conozco esa skill.' };
    }
    return {
      ok: false,
      message: `La skill "${enOtraSuperficie.name}" no esta disponible por WhatsApp. Puedes usarla desde el chat del Hub.`,
    };
  }

  if (isGroup && skill.blockedInGroups) {
    return {
      ok: false,
      message: `La skill "${skill.name}" no se ejecuta en grupos: su resultado quedaria visible para todos los miembros. Escribeme por privado.`,
    };
  }

  return { ok: true, skill };
}

/** Texto del comando `/skills`. */
export async function buildSkillsCommandText(isGroup: boolean): Promise<string> {
  const skills = await availableWhatsAppSkills(isGroup);
  if (skills.length === 0) {
    return isGroup
      ? 'No hay skills disponibles en grupos. Escribeme por privado para usarlas.'
      : 'No hay skills disponibles por WhatsApp en este momento.';
  }

  const lineas = skills.map((skill) => `- *${skill.name}*: ${skill.description ?? 'Sin descripcion.'}`);
  return ['*Skills disponibles por WhatsApp*', '', ...lineas].join('\n');
}
