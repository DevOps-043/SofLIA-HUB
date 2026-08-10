import type { Skill } from '../../shared/skills/types';
import type { SkillCatalog } from './catalog';

/**
 * Invocacion de Skills por comando: el usuario escribe `/` y el nombre.
 *
 * El comando se deriva del NOMBRE de la Skill, no de un campo aparte: asi una
 * Skill que el usuario acaba de crear como "Resumen ejecutivo" se invoca como
 * `/resumen-ejecutivo` sin pedirle que configure nada mas.
 */

export interface SkillCommand {
  skill: Skill;
  /** Comando sin la barra, en minusculas y sin acentos. */
  command: string;
}

/** Convierte un nombre en comando: minusculas, sin acentos, con guiones. */
export function toSkillCommand(name: string): string {
  return String(name ?? '')
    .toLowerCase()
    .normalize('NFD')
    // Rango de diacriticos combinantes: "presentación" -> "presentacion".
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

/**
 * Comandos del catalogo. Si dos Skills producen el mismo comando, gana la
 * primera del catalogo (las del sistema van antes): un comando ambiguo
 * resuelto al azar seria peor que uno estable.
 */
export function buildSkillCommands(catalog: SkillCatalog): SkillCommand[] {
  const seen = new Set<string>();
  const commands: SkillCommand[] = [];

  for (const skill of catalog.all) {
    // Prioridad: comando declarado (sistema) o configurado por el usuario;
    // si no hay ninguno, se deriva del nombre, de modo que una Skill recien
    // creada ya es invocable sin configurar nada.
    const command = toSkillCommand(skill.command || skill.name);
    if (!command || seen.has(command)) continue;
    seen.add(command);
    commands.push({ skill, command });
  }

  return commands;
}

/**
 * Interpreta lo que hay en el compositor.
 *
 * `activo` mientras el texto es solo un comando en construccion: ahi el menu
 * debe estar visible y Enter activa la Skill en vez de enviar el mensaje. En
 * cuanto el usuario escribe algo mas, vuelve a ser un mensaje normal.
 */
export interface SlashQuery {
  /** Texto tras la barra, normalizado. */
  term: string;
  /** Coincidencia exacta con un comando, si la hay. */
  exact: SkillCommand | null;
  /** Coincidencias para el menu, ordenadas por relevancia. */
  matches: SkillCommand[];
}

export function parseSlashInput(input: string, commands: SkillCommand[]): SlashQuery | null {
  const raw = String(input ?? '');
  // Solo al inicio y sin espacios: "/presentacion" es un comando,
  // "/presentacion para Acme" ya es un mensaje con contexto.
  if (!raw.startsWith('/')) return null;

  const body = raw.slice(1);
  if (/\s/.test(body)) return null;

  const term = toSkillCommand(body);
  const matches = commands
    .filter((entry) => !term || entry.command.startsWith(term) || entry.command.includes(term))
    .sort((left, right) => rank(left, term) - rank(right, term))
    .slice(0, 8);

  return {
    term,
    exact: commands.find((entry) => entry.command === term) ?? null,
    matches,
  };
}

/** Prefijo antes que coincidencia interna; a igualdad, orden del catalogo. */
function rank(entry: SkillCommand, term: string): number {
  if (!term) return 1;
  return entry.command.startsWith(term) ? 0 : 1;
}
