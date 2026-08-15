import { channelsFromSettings, skillsActiveOnSurface } from '../../src/shared/skills/channels';
import { toSkillCommand } from '../../src/services/skills/slash-commands';
import type { SkillSurface, SystemSkill } from '../../src/shared/skills/types';
import { skillChannelsFor } from './skill-channels-store';
import { systemSkillsFor } from './system-skills-store';

/**
 * Resolucion de Skills para un canal de mensajeria.
 *
 * Compartido por WhatsApp y Telegram a proposito. Cada canal tenia antes su
 * propia lista —Telegram ni siquiera resolvia el catalogo, sino un menu fijo de
 * comandos— y eso significaba que retirar una Skill del catalogo la dejaba viva
 * en uno de los dos. Con una sola resolucion, una retirada vale en todas partes.
 *
 * Solo Skills del SISTEMA: las del usuario viven en su sesion del Hub y no se
 * resuelven desde un canal. Las guardas del canal se aplican ENCIMA de lo que
 * devuelve este modulo, nunca al reves.
 */

export type SkillAvailability =
  | { ok: true; skill: SystemSkill }
  | { ok: false; message: string };

/**
 * Skills invocables en una superficie para un usuario.
 *
 * `userId` acota por los canales que el usuario eligio. Sin usuario resuelto
 * —un remitente que todavia no tiene principal— manda el catalogo: la ausencia
 * de eleccion nunca retira una capacidad.
 */
export async function skillsForChannel(input: {
  surface: SkillSurface;
  userId?: string | null;
  isGroup: boolean;
}): Promise<SystemSkill[]> {
  const [skills, channels] = await Promise.all([
    systemSkillsFor(input.surface),
    skillChannelsFor(input.userId),
  ]);
  return skillsActiveOnSurface(skills, input.surface, channelsFromSettings(channels))
    .filter((skill) => !(input.isGroup && skill.blockedInGroups));
}

/**
 * Resuelve si una Skill puede ejecutarse aqui, distinguiendo los motivos de
 * rechazo para que el usuario sepa que hacer en cada caso: no existe, existe
 * pero no en esta superficie, o esta bloqueada en grupos.
 */
export async function resolveChannelSkill(input: {
  skillId: string;
  surface: SkillSurface;
  userId?: string | null;
  isGroup: boolean;
}): Promise<SkillAvailability> {
  const enSuperficie = await systemSkillsFor(input.surface);
  const skill = enSuperficie.find((entry) => entry.id === input.skillId);

  if (!skill) {
    // Se consulta el chat para separar "aqui no" de "en ninguna parte": el
    // catalogo pudo retirarla entera, y mandar al usuario al Hub seria mandarlo
    // a un sitio donde tampoco esta.
    const enChat = await systemSkillsFor('chat');
    const enOtraSuperficie = enChat.find((entry) => entry.id === input.skillId);
    if (!enOtraSuperficie) return { ok: false, message: 'No conozco esa skill.' };
    return {
      ok: false,
      message: `La skill "${enOtraSuperficie.name}" no esta disponible por ${nombreDeCanal(input.surface)}. Puedes usarla desde el chat del Hub.`,
    };
  }

  if (input.isGroup && skill.blockedInGroups) {
    return {
      ok: false,
      message: `La skill "${skill.name}" no se ejecuta en grupos: su resultado quedaria visible para todos los miembros. Escribeme por privado.`,
    };
  }

  // La eleccion del usuario se comprueba al final: es la unica que puede
  // retirarla estando disponible en la superficie, y su mensaje es distinto.
  const channels = await skillChannelsFor(input.userId);
  const activas = skillsActiveOnSurface([skill], input.surface, channelsFromSettings(channels));
  if (activas.length === 0) {
    return {
      ok: false,
      message: `Tienes desactivada la skill "${skill.name}" en ${nombreDeCanal(input.surface)}. Puedes reactivarla desde Ajustes → Integraciones & Skills.`,
    };
  }

  return { ok: true, skill };
}

/** Busca la Skill que corresponde a un comando escrito por el usuario. */
export function findSkillByCommand(skills: readonly SystemSkill[], rawCommand: string): SystemSkill | null {
  const comando = toSkillCommand(String(rawCommand || '').replace(/^\/+/, ''));
  if (!comando) return null;
  return skills.find((skill) => toSkillCommand(skill.command || skill.name) === comando)
    ?? skills.find((skill) => toSkillCommand(skill.name) === comando)
    ?? null;
}

/** Texto del comando `/skills` en un canal de mensajeria. */
export async function buildSkillsCatalogText(input: {
  surface: SkillSurface;
  userId?: string | null;
  isGroup: boolean;
}): Promise<string> {
  const skills = await skillsForChannel(input);
  const canal = nombreDeCanal(input.surface);
  if (skills.length === 0) {
    return input.isGroup
      ? 'No hay skills disponibles en grupos. Escribeme por privado para usarlas.'
      : `No hay skills disponibles por ${canal} en este momento.`;
  }

  // Nombre Y comando: el nombre es por lo que el usuario la reconoce, y el
  // comando es lo que tiene que escribir. Con uno solo, o no la identifica o no
  // sabe invocarla.
  const lineas = skills.map((skill) => {
    const comando = toSkillCommand(skill.command || skill.name);
    return `- *${skill.name}* (/${comando}): ${skill.description ?? 'Sin descripcion.'}`;
  });
  return [`*Skills disponibles por ${canal}*`, '', ...lineas].join('\n');
}

function nombreDeCanal(surface: SkillSurface): string {
  if (surface === 'whatsapp') return 'WhatsApp';
  if (surface === 'telegram') return 'Telegram';
  return 'el chat del Hub';
}
