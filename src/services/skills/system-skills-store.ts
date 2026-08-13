import { supabase } from '../../lib/supabase';
import type { SystemSkillRow } from '../../shared/skills/types';

/**
 * Lectura del catalogo de Skills del sistema desde `public.system_skills`.
 *
 * La tabla es global y no tiene dueño: la lee cualquier usuario autenticado y
 * solo `service_role` la escribe. Este modulo NUNCA escribe.
 *
 * Devuelve `null` —no una lista vacia— cuando la consulta falla. La diferencia
 * es la que decide el respaldo: sin catalogo manda la version instalada, y un
 * catalogo vacio de verdad tambien la respeta. Solo una fila con `enabled` en
 * falso retira una Skill.
 */

const COLUMNAS =
  'id, name, description, icon, command, category, surfaces, sort_order, enabled, ' +
  'blocked_in_groups, starter_prompts, instructions, tools, workspace, min_app_version';

/**
 * Caché de sesion. El catalogo cambia con una intervencion de operador, no
 * durante el uso: consultarlo en cada apertura de la biblioteca anadiria una
 * ida y vuelta a la base de datos por cada `/` que escriba el usuario.
 */
let cache: Promise<SystemSkillRow[] | null> | null = null;

async function consultar(): Promise<SystemSkillRow[] | null> {
  try {
    const { data, error } = await supabase
      .from('system_skills')
      .select(COLUMNAS)
      .order('sort_order', { ascending: true });

    if (error) {
      console.warn('[CatalogoSistema] No se pudo leer el catalogo remoto:', error.message);
      return null;
    }
    // La tabla no esta en los tipos generados de Supabase, asi que el cliente
    // no puede inferir la forma. El mapeo real —y la desconfianza— viven en
    // `system-catalog.ts`; aqui solo se transporta.
    return (data ?? []) as unknown as SystemSkillRow[];
  } catch (error) {
    // Red caida, sesion sin resolver o tabla todavia sin migrar: ninguna de las
    // tres puede dejar al usuario sin sus Skills ni romper la interfaz.
    console.warn('[CatalogoSistema] No se pudo leer el catalogo remoto:', error);
    return null;
  }
}

export function loadSystemSkillRows(): Promise<SystemSkillRow[] | null> {
  if (!cache) {
    cache = consultar().then((filas) => {
      // Un fallo no se cachea: la siguiente consulta vuelve a intentarlo, que es
      // lo que permite recuperarse cuando vuelve la red sin reiniciar.
      if (filas === null) cache = null;
      return filas;
    });
  }
  return cache;
}

/** Fuerza una relectura. Uso previsto: pruebas y recarga manual del catalogo. */
export function resetSystemSkillsCache(): void {
  cache = null;
}
