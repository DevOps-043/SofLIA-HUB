import { supabase } from '../../lib/supabase';
import { normalizeChannels, type SkillChannelSelection } from '../../shared/skills/channels';
import type { SkillChannel } from '../../shared/skills/types';

/**
 * Canales activos de cada Skill para el usuario en sesion, sobre
 * `public.user_skill_channels`.
 *
 * Devuelve `null` —no un objeto vacio— cuando la consulta falla. La diferencia
 * decide el respaldo: sin eleccion resuelta, cada Skill queda activa en todos
 * los canales que declara su catalogo. Un objeto vacio de verdad significa lo
 * mismo, porque solo una fila con la lista recortada retira canales.
 *
 * El aislamiento real lo aplica RLS por `auth.uid()`; el filtro por usuario de
 * este modulo es una segunda barrera, no la principal.
 */

const COLUMNAS = 'skill_id, channels';

let cache: Promise<SkillChannelSelection | null> | null = null;

async function consultar(): Promise<SkillChannelSelection | null> {
  try {
    const { data: sesion } = await supabase.auth.getUser();
    const userId = sesion?.user?.id;
    // Sin sesion no hay eleccion que resolver, y eso NO es un fallo: el
    // catalogo manda, igual que para un usuario que nunca configuro nada.
    if (!userId) return {};

    const { data, error } = await supabase
      .from('user_skill_channels')
      .select(COLUMNAS)
      .eq('user_id', userId);

    if (error) {
      console.warn('[CanalesSkills] No se pudo leer la eleccion de canales:', error.message);
      return null;
    }

    const seleccion: Record<string, SkillChannel[]> = {};
    for (const fila of data ?? []) {
      const skillId = String((fila as { skill_id?: unknown }).skill_id ?? '').trim();
      if (!skillId) continue;
      seleccion[skillId] = normalizeChannels((fila as { channels?: unknown }).channels);
    }
    return seleccion;
  } catch (error) {
    console.warn('[CanalesSkills] No se pudo leer la eleccion de canales:', error);
    return null;
  }
}

export function loadSkillChannels(): Promise<SkillChannelSelection | null> {
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
    .from('user_skill_channels')
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
    .from('user_skill_channels')
    .delete()
    .eq('user_id', userId)
    .eq('skill_id', String(skillId || '').trim());

  if (error) throw new Error(`No se pudieron restablecer los canales: ${error.message}`);
  resetSkillChannelsCache();
}

/** Fuerza una relectura. Uso previsto: tras escribir, y en pruebas. */
export function resetSkillChannelsCache(): void {
  cache = null;
}
