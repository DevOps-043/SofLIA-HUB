import { irisSupa, isIrisConfigured } from '../../lib/iris-client';
import type { IrisTeam } from './types';

/**
 * @param teamIds Si se pasa (incluso vacio), filtra los equipos de la organizacion activa
 *   (equipos SOFIA = equipos IRIS por id). Si es undefined, devuelve todos (compat).
 */
export async function getTeams(teamIds?: string[]): Promise<IrisTeam[]> {
  try {
    if (!irisSupa || !isIrisConfigured()) return [];
    if (teamIds && teamIds.length === 0) return [];
    let query = irisSupa.from('teams').select('*').eq('status', 'active').order('name');
    if (teamIds) query = query.in('team_id', teamIds);
    const { data, error } = await query;
    if (!error) return data || [];
    let fallbackQuery = irisSupa.from('teams').select('*').order('name');
    if (teamIds) fallbackQuery = fallbackQuery.in('team_id', teamIds);
    const { data: fallback, error: fallbackError } = await fallbackQuery;
    if (fallbackError) return [];
    return fallback || [];
  } catch {
    return [];
  }
}
