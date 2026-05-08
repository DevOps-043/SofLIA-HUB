import { getIrisClient } from '../clients';
import type { SofiaUser } from './types';

export function buildFullName(user: SofiaUser, fallback?: string): string {
  return (
    user.display_name ||
    `${user.first_name || ''} ${user.last_name || ''}`.trim() ||
    user.username ||
    fallback ||
    user.email ||
    ''
  );
}

export async function fetchUserTeamIds(userId: string): Promise<string[]> {
  const iris = getIrisClient();
  if (!iris) return [];

  try {
    const { data: memberships } = await iris
      .from('team_members')
      .select('team_id')
      .eq('user_id', userId);
    return (memberships || []).map((membership) => membership.team_id);
  } catch {
    return [];
  }
}
