import { isRegisteredSkillTool, isSkillWebSearch, type SkillWebSearch } from './tool-registry';
import { isToolSelectableByUser } from './surface-tools';

/**
 * Resolucion de la seleccion de herramientas que el usuario hace por Skill.
 *
 * Modulo PURO: sin red, sin disco y sin `import.meta`. Lo usan igual el chat,
 * WhatsApp y Telegram, que es lo que garantiza que acotar una Skill valga en
 * todas partes y no solo donde se configuro.
 *
 * Tres invariantes gobiernan este modulo, y de ellas depende que la pantalla de
 * configuracion no sea una escalada de privilegios:
 *
 *  1. ACOTA, NUNCA AMPLIA. El resultado es siempre un subconjunto de lo que la
 *     superficie ya ofrecia. No existe forma de que una seleccion conceda algo
 *     que el turno no tuviera.
 *  2. La AUSENCIA de seleccion no retira nada. Una Skill sin configurar sigue
 *     viendo lo mismo que antes de que esta pantalla existiera.
 *  3. Seleccionar no autoriza. Las confirmaciones viven en el ejecutor y no se
 *     consultan aqui.
 */

/** Seleccion del usuario. `null`/ausente = no ha elegido. */
export type SkillToolSelection = readonly string[] | null | undefined;

/**
 * Herramientas efectivas del turno.
 *
 * @param surfaceTools Lo que la superficie ya ofrece (y el canal autoriza).
 * @param selection Lo que el usuario eligio para esta Skill.
 */
export function resolveSkillTools(
  surfaceTools: readonly string[],
  selection: SkillToolSelection,
): string[] {
  // Invariante 2: sin eleccion, el catalogo queda intacto.
  const elegidas = normalizeToolSelection(selection);
  if (elegidas === null) return [...surfaceTools];

  // Invariante 1: interseccion. `surfaceTools` es el techo, siempre.
  const disponibles = new Set(surfaceTools);
  return elegidas.filter((tool) => disponibles.has(tool));
}

/**
 * Normaliza una seleccion guardada.
 *
 * Devuelve `null` cuando no hay eleccion —que NO es lo mismo que una lista
 * vacia, la cual significa "ninguna herramienta"—. Descarta identificadores
 * desconocidos y no seleccionables en vez de propagarlos: la fila la escribio
 * otra version del producto, y una version nueva puede introducir herramientas
 * que esta todavia no entiende.
 */
export function normalizeToolSelection(selection: SkillToolSelection): string[] | null {
  if (selection === null || selection === undefined) return null;
  if (!Array.isArray(selection)) return null;

  const limpias = new Set<string>();
  for (const item of selection) {
    if (typeof item !== 'string') continue;
    const nombre = item.trim();
    if (!nombre) continue;
    if (!isRegisteredSkillTool(nombre) || !isToolSelectableByUser(nombre)) continue;
    limpias.add(nombre);
  }
  return [...limpias];
}

/** Si el usuario configuro herramientas para esta Skill. */
export function hasToolSelection(selection: SkillToolSelection): boolean {
  return normalizeToolSelection(selection) !== null;
}

/**
 * Seleccion efectiva de una Skill pasiva: la suya si declara, y si no la de la
 * Skill que ejecuta. Una rutina que corre sin nadie delante es justo donde mas
 * importa poder acotar por separado.
 */
export function resolvePassiveToolSelection(
  ruleSelection: SkillToolSelection,
  skillSelection: SkillToolSelection,
): string[] | null {
  const propia = normalizeToolSelection(ruleSelection);
  return propia !== null ? propia : normalizeToolSelection(skillSelection);
}

export function normalizeWebSearch(value: unknown): SkillWebSearch {
  return isSkillWebSearch(value) ? value : 'auto';
}

/**
 * Si el turno debe buscar en la web.
 *
 * `auto` delega en la heuristica de siempre, que es la que decide segun lo que
 * el usuario escribio. Los otros dos estados la sustituyen.
 */
export function shouldSearchWeb(setting: SkillWebSearch, heuristic: boolean): boolean {
  if (setting === 'siempre') return true;
  if (setting === 'nunca') return false;
  return heuristic;
}
