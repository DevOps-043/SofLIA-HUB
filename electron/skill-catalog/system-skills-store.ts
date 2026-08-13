import { app } from 'electron';
import { getHubDbClient } from '../hub-db-client';
import {
  isSystemSkillDisabledByEnv,
  systemSkillsForSurface,
} from '../../src/shared/skills/registry';
import { mergeSystemSkills } from '../../src/shared/skills/system-catalog';
import type { SkillSurface, SystemSkill, SystemSkillRow } from '../../src/shared/skills/types';

/**
 * Catalogo de Skills del sistema para MAIN.
 *
 * El agente de WhatsApp resuelve el mismo catalogo que el chat del Hub, con el
 * mismo acotado y el mismo respaldo: si las dos superficies leyeran de sitios
 * distintos, una Skill retirada seguiria viva en una de ellas.
 *
 * Main lee con su propio cliente (`hub-db-client`) en vez de pedirselo al
 * renderer: el agente de WhatsApp funciona sin que haya una ventana abierta.
 */

const COLUMNAS =
  'id, name, description, icon, command, category, surfaces, sort_order, enabled, ' +
  'blocked_in_groups, starter_prompts, instructions, tools, workspace, min_app_version';

let cache: Promise<SystemSkillRow[] | null> | null = null;

async function consultar(): Promise<SystemSkillRow[] | null> {
  try {
    const { data, error } = await getHubDbClient()
      .from('system_skills')
      .select(COLUMNAS)
      .order('sort_order', { ascending: true });

    if (error) {
      console.warn('[CatalogoSistema] No se pudo leer el catalogo remoto:', error.message);
      return null;
    }
    return (data ?? []) as unknown as SystemSkillRow[];
  } catch (error) {
    // Sin credenciales configuradas, sin red o con la tabla aun sin migrar: se
    // resuelve el respaldo en codigo en vez de dejar WhatsApp sin skills.
    console.warn('[CatalogoSistema] No se pudo leer el catalogo remoto:', error);
    return null;
  }
}

function loadRows(): Promise<SystemSkillRow[] | null> {
  if (!cache) {
    cache = consultar().then((filas) => {
      // Un fallo no se cachea: la siguiente consulta reintenta y el agente se
      // recupera cuando vuelve la red, sin reiniciar la aplicacion.
      if (filas === null) cache = null;
      return filas;
    });
  }
  return cache;
}

/** Version instalada. Sin ella, ninguna fila queda bloqueada por version. */
function versionInstalada(): string {
  try {
    return typeof app?.getVersion === 'function' ? app.getVersion() : '';
  } catch {
    return '';
  }
}

/**
 * Catalogo del sistema ya fusionado y acotado para una superficie.
 *
 * El entorno se lee en CADA llamada: la bandera local es el interruptor de
 * emergencia y debe poder cambiarse sin reconstruir la aplicacion.
 */
export async function systemSkillsFor(surface: SkillSurface): Promise<SystemSkill[]> {
  const rows = await loadRows();
  return mergeSystemSkills({
    code: systemSkillsForSurface(surface, process.env),
    rows,
    surface,
    appVersion: versionInstalada(),
  }).filter((skill) => !isSystemSkillDisabledByEnv(skill.id, process.env));
}

/** Fuerza una relectura. Uso previsto: pruebas y recarga manual del catalogo. */
export function resetSystemSkillsCache(): void {
  cache = null;
}
