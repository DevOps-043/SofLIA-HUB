import { irisSupa, isIrisConfigured } from '../../lib/iris-client';
import type { IrisTeam } from './types';

export async function getTeams(): Promise<IrisTeam[]> {
  try {
    if (!irisSupa || !isIrisConfigured()) return [];
    const { data, error } = await irisSupa.from('teams').select('*').eq('status', 'active').order('name');
    if (!error) return data || [];
    const { data: fallback, error: fallbackError } = await irisSupa.from('teams').select('*').order('name');
    if (fallbackError) return [];
    return fallback || [];
  } catch {
    return [];
  }
}
