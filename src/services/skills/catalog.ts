import appPackage from '../../../package.json';
import {
  isSystemSkillDisabledByEnv,
  isSystemSkillId,
  systemSkillsForSurface,
} from '../../shared/skills/registry';
import { mergeSystemSkills } from '../../shared/skills/system-catalog';
import { skillsActiveOnSurface, type SkillChannelSelection } from '../../shared/skills/channels';
import { RENDERER_SKILL_FLAGS } from './skill-flags';
import type { Skill, SkillSurface, SystemSkill, UserSkill } from '../../shared/skills/types';
import { loadSkillChannels } from './skill-channels-store';
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
  /**
   * Eleccion de canales del usuario, sin aplicar. La expone el catalogo para
   * que la configuracion pueda mostrar el estado real de cada Skill: la lista
   * `all` ya viene acotada y no permitiria distinguir "desactivada aqui" de
   * "no existe".
   *
   * Opcional porque ausente y `null` significan lo mismo —no hay eleccion
   * resuelta— y en ese caso manda el catalogo. Un catalogo construido a mano
   * (estado inicial, pruebas) no tiene que declararla para ser correcto.
   */
  channels?: SkillChannelSelection | null;
}

/**
 * Catalogo efectivo para una superficie.
 *
 * Se acota dos veces y en este orden: primero por lo que el CATALOGO declara
 * (superficie, bandera, version), y despues por lo que el USUARIO eligio. El
 * orden importa: la eleccion del usuario acota lo declarado, nunca lo amplia.
 *
 * `includeInactive` conserva las Skills desactivadas por el usuario. Lo usa la
 * pantalla de configuracion, que necesita listar lo que esta apagado para poder
 * encenderlo; ninguna superficie de ejecucion debe usarlo.
 */
export async function resolveSkillCatalog(
  surface: SkillSurface = 'chat',
  options: { includeInactive?: boolean } = {},
): Promise<SkillCatalog> {
  const [rows, user, channels] = await Promise.all([
    loadSystemSkillRows(),
    loadUserSkills(),
    loadSkillChannels(),
  ]);
  const system = mergeSystemSkills({
    code: systemSkillsForSurface(surface, RENDERER_SKILL_FLAGS),
    rows,
    surface,
    appVersion: appPackage.version,
    // El apagado local manda sobre el catalogo remoto: un despliegue debe poder
    // retirar una capacidad sin depender de que la base de datos responda.
  }).filter((skill) => !isSystemSkillDisabledByEnv(skill.id, RENDERER_SKILL_FLAGS));

  if (options.includeInactive) {
    return { system, user, all: [...system, ...user], channels };
  }

  const systemActivas = skillsActiveOnSurface(system, surface, channels);
  const userActivas = skillsActiveOnSurface(user, surface, channels);
  return {
    system: systemActivas,
    user: userActivas,
    all: [...systemActivas, ...userActivas],
    channels,
  };
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
