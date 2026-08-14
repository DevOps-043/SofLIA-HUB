import {
  buildSkillsCatalogText,
  findSkillByCommand,
  resolveChannelSkill,
  skillsForChannel,
  type SkillAvailability,
} from '../../skill-catalog/channel-skills';
import type { SystemSkill } from '../../../src/shared/skills/types';

/**
 * Catalogo de Skills en WhatsApp.
 *
 * La resolucion vive en `skill-catalog/channel-skills.ts`, compartida con
 * Telegram: dos resoluciones separadas divergen, y una Skill retirada del
 * catalogo seguiria viva en uno de los dos canales.
 */

export type { SkillAvailability };

export function availableWhatsAppSkills(isGroup: boolean, userId?: string | null): Promise<SystemSkill[]> {
  return skillsForChannel({ surface: 'whatsapp', userId, isGroup });
}

export function resolveWhatsAppSkill(
  skillId: string,
  isGroup: boolean,
  userId?: string | null,
): Promise<SkillAvailability> {
  return resolveChannelSkill({ skillId, surface: 'whatsapp', userId, isGroup });
}

export function buildSkillsCommandText(isGroup: boolean, userId?: string | null): Promise<string> {
  return buildSkillsCatalogText({ surface: 'whatsapp', userId, isGroup });
}

/** Skill que corresponde a un comando escrito en WhatsApp, si la hay. */
export async function findWhatsAppSkillByCommand(
  command: string,
  isGroup: boolean,
  userId?: string | null,
): Promise<SystemSkill | null> {
  const skills = await availableWhatsAppSkills(isGroup, userId);
  return findSkillByCommand(skills, command);
}
