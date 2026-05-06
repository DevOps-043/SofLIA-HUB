/**
 * Repositorio de status (estados de issue) IRIS.
 *
 * Cada equipo tiene su propio set de status (backlog, todo, in_progress, etc.)
 * con nombres y colores customizables. La función de aliases permite que el
 * resolver acepte tanto el nombre custom como el tipo canónico.
 */

import { getIrisClient } from './clients';
import type { IrisStatusRecord } from './types';

export async function fetchStatusesByTeamId(teamId: string): Promise<IrisStatusRecord[]> {
  const iris = getIrisClient();
  if (!iris) return [];

  try {
    const { data, error } = await iris
      .from('task_statuses')
      .select('*')
      .eq('team_id', teamId)
      .order('position');

    if (error) {
      console.error('[IRIS-Main] fetchStatusesByTeamId error:', error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error('[IRIS-Main] fetchStatusesByTeamId exception:', err);
    return [];
  }
}

/**
 * Construye sinónimos para resolver un status por nombre humano.
 * Permite que el LLM use "in progress", "doing", "en progreso", etc.
 * intercambiablemente.
 */
export function buildStatusAliases(status: IrisStatusRecord): string[] {
  const aliases = [status.name, status.status_type];

  switch (status.status_type) {
    case 'backlog':
      aliases.push('por definir');
      break;
    case 'todo':
      aliases.push('to do', 'pendiente', 'por hacer');
      break;
    case 'in_progress':
      aliases.push('en progreso', 'doing');
      break;
    case 'in_review':
      aliases.push('revision', 'review', 'en revision');
      break;
    case 'done':
      aliases.push('hecho', 'completado', 'completed');
      break;
    case 'cancelled':
      aliases.push('cancelado');
      break;
    default:
      break;
  }

  return aliases;
}
