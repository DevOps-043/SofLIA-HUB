/**
 * Repositorio de prioridades IRIS.
 *
 * A diferencia de status, las prioridades son globales (no por equipo).
 */

import { getIrisClient } from './clients';
import type { IrisPriorityRecord } from './types';

export async function getPriorities(): Promise<IrisPriorityRecord[]> {
  const iris = getIrisClient();
  if (!iris) return [];

  try {
    const { data, error } = await iris
      .from('task_priorities')
      .select('*')
      .order('level');

    if (error) {
      console.error('[IRIS-Main] getPriorities error:', error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error('[IRIS-Main] getPriorities exception:', err);
    return [];
  }
}

/**
 * Sinónimos en inglés para prioridades nombradas en español.
 */
export function buildPriorityAliases(priority: IrisPriorityRecord): string[] {
  const normalized = priority.name.toLowerCase();
  const aliases = [priority.name];

  if (normalized.includes('urgente')) aliases.push('urgent', 'critical');
  if (normalized.includes('alta')) aliases.push('high');
  if (normalized.includes('media')) aliases.push('medium');
  if (normalized.includes('baja')) aliases.push('low');
  if (normalized.includes('sin prioridad')) aliases.push('none', 'no priority');

  return aliases;
}
