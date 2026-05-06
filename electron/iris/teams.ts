/**
 * Repositorio de equipos IRIS.
 *
 * Funciones "raw" — toman IDs ya resueltos, no aceptan refs humanas.
 * Las versiones públicas que aceptan refs viven en `operations.ts` y usan
 * `resolvers.ts` para mapear ref → ID antes de llamar aquí.
 */

import { getIrisClient } from './clients';
import type { IrisTeam, IrisTeamMember, IrisTeamMemberDetail } from './types';

export async function getTeams(): Promise<IrisTeam[]> {
  const iris = getIrisClient();
  if (!iris) return [];

  try {
    const { data, error } = await iris
      .from('teams')
      .select('*')
      .eq('status', 'active')
      .order('name');

    if (error) {
      // Fallback: try all teams sin filtro de status (esquemas antiguos).
      const { data: all } = await iris.from('teams').select('*').order('name');
      return all || [];
    }
    return data || [];
  } catch (err) {
    console.error('[IRIS-Main] getTeams error:', err);
    return [];
  }
}

interface RawTeamMember {
  member_id?: string;
  membership_id?: string;
  team_id: string;
  user_id: string;
  role: string;
  joined_at: string;
}

function normalizeTeamMemberRecord(member: RawTeamMember): IrisTeamMember {
  return {
    ...member,
    member_id: member.member_id ?? member.membership_id ?? '',
    membership_id: member.membership_id ?? member.member_id,
  };
}

export async function fetchTeamMembersByTeamId(teamId: string): Promise<IrisTeamMember[]> {
  const iris = getIrisClient();
  if (!iris) return [];

  try {
    const { data, error } = await iris
      .from('team_members')
      .select('*')
      .eq('team_id', teamId)
      .eq('is_active', true);

    if (error) {
      console.error('[IRIS-Main] fetchTeamMembersByTeamId error:', error);
      return [];
    }
    return (data || []).map(normalizeTeamMemberRecord);
  } catch (err) {
    console.error('[IRIS-Main] fetchTeamMembersByTeamId exception:', err);
    return [];
  }
}

export async function fetchTeamMembersDetailedByTeamId(
  teamId: string,
): Promise<IrisTeamMemberDetail[]> {
  const iris = getIrisClient();
  if (!iris) return [];

  try {
    const members = await fetchTeamMembersByTeamId(teamId);
    if (members.length === 0) return [];

    const userIds = Array.from(new Set(members.map((m) => m.user_id).filter(Boolean)));
    if (userIds.length === 0) return members;

    const { data, error } = await iris
      .from('account_users')
      .select('user_id, display_name, email, username')
      .in('user_id', userIds);

    if (error) {
      console.error('[IRIS-Main] fetchTeamMembersDetailedByTeamId error:', error);
      return members;
    }

    type AccountUser = { user_id: string; display_name?: string | null; email?: string | null; username?: string | null };
    const byUserId = new Map<string, AccountUser>(
      (data || []).map((user: AccountUser) => [user.user_id, user]),
    );

    return members.map((member) => {
      const user = byUserId.get(member.user_id);
      return {
        ...member,
        display_name: user?.display_name ?? null,
        email: user?.email ?? null,
        username: user?.username ?? null,
      };
    });
  } catch (err) {
    console.error('[IRIS-Main] fetchTeamMembersDetailedByTeamId exception:', err);
    return [];
  }
}
