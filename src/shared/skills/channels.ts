/**
 * Resolucion de los canales en los que una Skill esta activa para un usuario.
 *
 * Modulo PURO: sin red, sin disco y sin `import.meta`. Lo usan igual el
 * renderer y main, que es lo que garantiza que el chat, WhatsApp y Telegram
 * decidan lo mismo sobre la misma Skill. Dos resoluciones separadas divergen;
 * ya paso con el catalogo antes de centralizarlo.
 *
 * Dos reglas gobiernan este modulo, y ninguna de las dos es simetrica:
 *
 * 1. La eleccion del usuario ACOTA lo que el catalogo declara; nunca lo amplia.
 *    Activar un canal que la Skill no declara no la hace disponible alli.
 * 2. La AUSENCIA de eleccion no retira nada. Una fila que no existe —porque el
 *    usuario nunca configuro esa Skill, o porque la consulta fallo— resuelve a
 *    todos los canales del catalogo. Es la misma asimetria que ya rige el
 *    catalogo del sistema, y por el mismo motivo: un fallo de lectura no puede
 *    dejar al usuario sin sus capacidades.
 */

import {
  isSkillChannel,
  surfaceToChannel,
  type Skill,
  type SkillChannel,
  type SkillSurface,
} from './types';

/**
 * Eleccion de canales del usuario, indexada por identificador de Skill.
 *
 * `null` significa "no se pudo resolver" y NO "ninguno": el consumidor debe
 * tratarlo como ausencia de eleccion, no como retirada.
 */
export type SkillChannelSelection = Readonly<Record<string, readonly SkillChannel[]>>;

/** Canales que una Skill declara, derivados de sus superficies. */
export function catalogChannelsForSkill(skill: Skill): SkillChannel[] {
  // Una Skill del usuario no declara superficies: vive en su sesion del Hub y
  // por eso solo existe en su computadora.
  if (skill.skillClass === 'usuario') return ['escritorio'];

  const canales = new Set<SkillChannel>();
  for (const superficie of skill.surfaces) {
    canales.add(superficie === 'chat' ? 'escritorio' : superficie);
  }
  return [...canales];
}

/**
 * Canales efectivos de una Skill: interseccion de lo que declara el catalogo
 * con lo que el usuario eligio.
 */
export function resolveChannelsForSkill(
  skill: Skill,
  selection: SkillChannelSelection | null | undefined,
): SkillChannel[] {
  const delCatalogo = catalogChannelsForSkill(skill);
  const elegidos = selection?.[skill.id];
  if (!elegidos) return delCatalogo;

  const permitidos = new Set(delCatalogo);
  return elegidos.filter((canal) => permitidos.has(canal));
}

/** Si la Skill esta activa en un canal concreto para este usuario. */
export function isSkillActiveOnChannel(
  skill: Skill,
  channel: SkillChannel,
  selection: SkillChannelSelection | null | undefined,
): boolean {
  return resolveChannelsForSkill(skill, selection).includes(channel);
}

/**
 * Acota una lista de Skills a las activas en una superficie para este usuario.
 * Es el filtro que aplican el chat, WhatsApp y Telegram sobre su catalogo.
 */
export function skillsActiveOnSurface<T extends Skill>(
  skills: readonly T[],
  surface: SkillSurface,
  selection: SkillChannelSelection | null | undefined,
): T[] {
  const canal = surfaceToChannel(surface);
  return skills.filter((skill) => isSkillActiveOnChannel(skill, canal, selection));
}

/**
 * Normaliza la lista de canales que llega de la base de datos. Un valor que no
 * es un canal conocido se descarta en vez de propagarse: la fila la escribe el
 * usuario desde otra version del producto, y una version nueva puede introducir
 * canales que esta todavia no entiende.
 */
export function normalizeChannels(value: unknown): SkillChannel[] {
  if (!Array.isArray(value)) return [];
  const canales = new Set<SkillChannel>();
  for (const item of value) {
    if (isSkillChannel(item)) canales.add(item);
  }
  return [...canales];
}
