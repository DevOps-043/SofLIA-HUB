import appPackage from '../../../package.json';
import {
  isSystemSkillDisabledByEnv,
  isSystemSkillId,
  systemSkillsForSurface,
} from '../../shared/skills/registry';
import { mergeSystemSkills } from '../../shared/skills/system-catalog';
import { RENDERER_SKILL_FLAGS } from './skill-flags';
import type { Skill, SkillSurface, SystemSkill, UserSkill } from '../../shared/skills/types';
import { loadSystemSkillRows } from './system-skills-store';
import { listUserSkills } from './user-skills-store';

/**
 * Resolucion del catalogo efectivo de Skills: catalogo del sistema mas Skills
 * del usuario autenticado, filtradas por superficie e identidad.
 *
 * Regla central: la clase se deriva de la FUENTE, y las dos fuentes del sistema
 * estan separadas de la del usuario. Las Skills del sistema salen del catalogo
 * global `public.system_skills` —que nadie salvo `service_role` escribe— con
 * respaldo en el registro en codigo; las del usuario, de `public.skills`, y se
 * marcan como 'usuario' al mapearlas. Una fila de `public.skills` jamas puede
 * presentarse como Skill del sistema, ni siquiera suplantando su identificador.
 */

export interface SkillCatalog {
  system: SystemSkill[];
  user: UserSkill[];
  all: Skill[];
}

export async function resolveSkillCatalog(surface: SkillSurface = 'chat'): Promise<SkillCatalog> {
  const [rows, user] = await Promise.all([loadSystemSkillRows(), loadUserSkills()]);
  const system = mergeSystemSkills({
    code: systemSkillsForSurface(surface, RENDERER_SKILL_FLAGS),
    rows,
    surface,
    appVersion: appPackage.version,
    // El apagado local manda sobre el catalogo remoto: un despliegue debe poder
    // retirar una capacidad sin depender de que la base de datos responda.
  }).filter((skill) => !isSystemSkillDisabledByEnv(skill.id, RENDERER_SKILL_FLAGS));

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
