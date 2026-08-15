import { getHubDbClient } from '../hub-db-client';
import { normalizeChannels, type SkillSettings, type SkillSettingsMap } from '../../src/shared/skills/channels';
import { normalizeToolSelection, normalizeWebSearch } from '../../src/shared/skills/tool-selection';

/**
 * Canales activos de cada Skill para un usuario, leidos desde MAIN.
 *
 * Existe separado del store del renderer por el mismo motivo que el catalogo
 * del sistema: los agentes de WhatsApp y Telegram funcionan sin que haya una
 * ventana abierta, y resuelven la identidad por numero de telefono o chat id,
 * no por sesion del renderer. Leen de la MISMA tabla para que la eleccion que
 * el usuario hace en el Hub valga en los canales sin reinstalar ni reiniciar.
 *
 * Devuelve `null` cuando la consulta falla: sin eleccion resuelta manda el
 * catalogo, que es lo que impide que un fallo de red deje al usuario sin sus
 * Skills en un canal.
 */

const COLUMNAS = 'skill_id, channels, tools, web_search';

/**
 * Cache por usuario. La eleccion cambia con una accion del usuario, no durante
 * el uso, pero se invalida en cada escritura del Hub via `resetSkillChannelsCache`
 * y con un TTL corto, porque main no se entera de que el renderer escribio.
 */
const TTL_MS = 60_000;
const cache = new Map<string, { at: number; value: Promise<SkillSettingsMap | null> }>();

async function consultar(userId: string): Promise<SkillSettingsMap | null> {
  try {
    const { data, error } = await getHubDbClient()
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
    // Sin credenciales, sin red o con la tabla aun sin migrar: manda el catalogo.
    console.warn('[CanalesSkills] No se pudo leer la eleccion de canales:', error);
    return null;
  }
}

export function skillChannelsFor(userId: string | null | undefined): Promise<SkillSettingsMap | null> {
  const id = String(userId || '').trim();
  // Sin usuario resuelto no hay eleccion que aplicar. Se devuelve ausencia, no
  // fallo: el canal seguira acotando por sus propias guardas de autorizacion.
  if (!id) return Promise.resolve({});

  const guardado = cache.get(id);
  if (guardado && Date.now() - guardado.at < TTL_MS) return guardado.value;

  const value = consultar(id).then((seleccion) => {
    // Un fallo no se cachea: la siguiente consulta reintenta.
    if (seleccion === null) cache.delete(id);
    return seleccion;
  });
  cache.set(id, { at: Date.now(), value });
  return value;
}

/** Fuerza una relectura. Uso previsto: pruebas y recarga manual. */
export function resetSkillChannelsCache(userId?: string): void {
  if (userId) cache.delete(String(userId).trim());
  else cache.clear();
}
