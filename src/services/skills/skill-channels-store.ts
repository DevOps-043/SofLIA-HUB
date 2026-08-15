import { supabase } from '../../lib/supabase';
import { normalizeChannels, type SkillSettings, type SkillSettingsMap } from '../../shared/skills/channels';
import { normalizeToolSelection, normalizeWebSearch } from '../../shared/skills/tool-selection';
import type { SkillChannel } from '../../shared/skills/types';

/**
 * Ajustes de cada Skill para el usuario en sesion, sobre
 * `public.user_skill_settings`: canales, herramientas y busqueda web.
 *
 * Devuelve `null` —no un objeto vacio— cuando la consulta falla. La diferencia
 * decide el respaldo: sin eleccion resuelta, cada Skill queda activa en todos
 * los canales que declara su catalogo. Un objeto vacio de verdad significa lo
 * mismo, porque solo una fila con la lista recortada retira canales.
 *
 * El aislamiento real lo aplica RLS por `auth.uid()`; el filtro por usuario de
 * este modulo es una segunda barrera, no la principal.
 */

const COLUMNAS = 'skill_id, channels, tools, web_search';

let cache: Promise<SkillSettingsMap | null> | null = null;

async function consultar(): Promise<SkillSettingsMap | null> {
  try {
    const { data: sesion } = await supabase.auth.getUser();
    const userId = sesion?.user?.id;
    // Sin sesion no hay eleccion que resolver, y eso NO es un fallo: el
    // catalogo manda, igual que para un usuario que nunca configuro nada.
    if (!userId) return {};

    const { data, error } = await supabase
      .from('user_skill_settings')
      .select(COLUMNAS)
      .eq('user_id', userId);

    if (error) {
      console.warn('[CanalesSkills] No se pudo leer la eleccion de canales:', error.message);
      return null;
    }

    const ajustes: Record<string, SkillSettings> = {};
    for (const fila of data ?? []) {
      const registro = fila as { skill_id?: unknown; channels?: unknown; tools?: unknown; web_search?: unknown };
      const skillId = String(registro.skill_id ?? '').trim();
      if (!skillId) continue;
      ajustes[skillId] = {
        channels: normalizeChannels(registro.channels),
        // `null` y array son distintos: sin eleccion vale toda la superficie.
        tools: registro.tools === null || registro.tools === undefined
          ? null
          : normalizeToolSelection(registro.tools as string[]),
        webSearch: normalizeWebSearch(registro.web_search),
      };
    }
    return ajustes;
  } catch (error) {
    console.warn('[CanalesSkills] No se pudo leer la eleccion de canales:', error);
    return null;
  }
}

export function loadSkillChannels(): Promise<SkillSettingsMap | null> {
  if (!cache) {
    cache = consultar().then((seleccion) => {
      // Un fallo no se cachea: la siguiente consulta reintenta y el usuario se
      // recupera cuando vuelve la red, sin reiniciar la aplicacion.
      if (seleccion === null) cache = null;
      return seleccion;
    });
  }
  return cache;
}

/**
 * Guarda los canales de una Skill. Una lista vacia es una eleccion legitima
 * ("en ninguno") y se persiste como tal: borrar la fila significaria lo
 * contrario, porque la ausencia devuelve todos los canales del catalogo.
 */
export async function saveSkillChannels(skillId: string, channels: readonly SkillChannel[]): Promise<void> {
  const { data: sesion } = await supabase.auth.getUser();
  const userId = sesion?.user?.id;
  if (!userId) throw new Error('Necesito una sesion iniciada para guardar los canales de la skill.');

  const id = String(skillId || '').trim();
  if (!id) throw new Error('No reconozco esa skill.');

  const { error } = await supabase
    .from('user_skill_settings')
    .upsert(
      {
        user_id: userId,
        skill_id: id,
        channels: normalizeChannels(channels),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,skill_id' },
    );

  if (error) throw new Error(`No se pudieron guardar los canales: ${error.message}`);
  resetSkillChannelsCache();
}

/**
 * Devuelve una Skill a su comportamiento por omision: activa en todos los
 * canales de su catalogo. Es lo que hace borrar la fila, y por eso no es lo
 * mismo que guardar una lista vacia.
 */
export async function clearSkillChannels(skillId: string): Promise<void> {
  const { data: sesion } = await supabase.auth.getUser();
  const userId = sesion?.user?.id;
  if (!userId) throw new Error('Necesito una sesion iniciada para restablecer los canales.');

  const { error } = await supabase
    .from('user_skill_settings')
    .delete()
    .eq('user_id', userId)
    .eq('skill_id', String(skillId || '').trim());

  if (error) throw new Error(`No se pudieron restablecer los canales: ${error.message}`);
  resetSkillChannelsCache();
}

/**
 * Guarda la seleccion de herramientas. `null` la retira, devolviendo la Skill a
 * "usa todo lo que ofrezca la superficie"; un array vacio significa "ninguna".
 */
export async function saveSkillTools(skillId: string, tools: readonly string[] | null): Promise<void> {
  const userId = await requireUserId('guardar las herramientas de la skill');
  const id = String(skillId || '').trim();
  if (!id) throw new Error('No reconozco esa skill.');

  const { error } = await supabase
    .from('user_skill_settings')
    .upsert(
      {
        user_id: userId,
        skill_id: id,
        tools: tools === null ? null : normalizeToolSelection(tools),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,skill_id' },
    );

  if (error) throw new Error(`No se pudieron guardar las herramientas: ${error.message}`);
  resetSkillChannelsCache();
}

export async function saveSkillWebSearch(skillId: string, webSearch: string): Promise<void> {
  const userId = await requireUserId('guardar la busqueda web de la skill');
  const id = String(skillId || '').trim();
  if (!id) throw new Error('No reconozco esa skill.');

  const { error } = await supabase
    .from('user_skill_settings')
    .upsert(
      {
        user_id: userId,
        skill_id: id,
        web_search: normalizeWebSearch(webSearch),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,skill_id' },
    );

  if (error) throw new Error(`No se pudo guardar la busqueda web: ${error.message}`);
  resetSkillChannelsCache();
}

async function requireUserId(accion: string): Promise<string> {
  const { data: sesion } = await supabase.auth.getUser();
  const userId = sesion?.user?.id;
  if (!userId) throw new Error(`Necesito una sesion iniciada para ${accion}.`);
  return userId;
}

/** Fuerza una relectura. Uso previsto: tras escribir, y en pruebas. */
export function resetSkillChannelsCache(): void {
  cache = null;
}
