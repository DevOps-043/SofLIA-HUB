import { isSystemSkillId, systemSkillsForSurface } from '../../shared/skills/registry';
import { RENDERER_SKILL_FLAGS } from './skill-flags';
import type { Skill, SkillSurface, SystemSkill, UserSkill } from '../../shared/skills/types';
import { listUserSkills } from './user-skills-store';

/**
 * Resolucion del catalogo efectivo de Skills: declaraciones del sistema mas
 * Skills del usuario autenticado, filtradas por superficie e identidad.
 *
 * Regla central: la clase se deriva de la FUENTE. Las Skills del sistema
 * salen del registro en codigo; las del usuario, de la base de datos, y se
 * marcan como 'usuario' al mapearlas. Una fila jamas puede presentarse como
 * Skill del sistema, ni siquiera suplantando su identificador.
 */

export interface SkillCatalog {
  system: SystemSkill[];
  user: UserSkill[];
  all: Skill[];
}

export async function resolveSkillCatalog(surface: SkillSurface = 'chat'): Promise<SkillCatalog> {
  const system = systemSkillsForSurface(surface, RENDERER_SKILL_FLAGS);
  const user = await loadUserSkills();
  return { system, user, all: [...system, ...user] };
}

/**
 * Skills del usuario, descartando las que intenten suplantar el
 * identificador de una Skill del sistema. Sin sesion devuelve lista vacia;
 * un fallo de red no debe dejar al usuario sin las Skills del sistema.
 */
async function loadUserSkills(): Promise<UserSkill[]> {
  try {
    const skills = await listUserSkills();
    return skills.filter((skill) => {
      if (isSystemSkillId(skill.id)) {
        console.warn('[SkillsCatalog] Skill de usuario con identificador reservado, descartada:', skill.id);
        return false;
      }
      return true;
    });
  } catch (error) {
    console.error('[SkillsCatalog] No se pudieron cargar las skills del usuario:', error);
    return [];
  }
}
