/**
 * Repositorio de proyectos IRIS.
 *
 * Funciones raw — toman teamId ya resuelto. Las versiones que aceptan refs
 * humanas (teamRef, projectRef) viven en `operations.ts`.
 */

import { getIrisClient } from './clients';
import type { IrisProject } from './types';

/**
 * Lista proyectos. Si `teamId` es `null` o `undefined`, devuelve todos los
 * proyectos accesibles (sin filtro de equipo).
 */
export async function fetchProjectsByTeamId(teamId: string | null): Promise<IrisProject[]> {
  const iris = getIrisClient();
  if (!iris) return [];

  try {
    let query = iris
      .from('pm_projects')
      .select('*')
      .order('updated_at', { ascending: false });

    if (teamId) {
      query = query.eq('team_id', teamId);
    }

    const { data, error } = await query;
    if (error) {
      console.error('[IRIS-Main] fetchProjectsByTeamId error:', error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error('[IRIS-Main] fetchProjectsByTeamId exception:', err);
    return [];
  }
}
