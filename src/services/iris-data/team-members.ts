import { irisSupa, isIrisConfigured } from '../../lib/iris-client';
import { resolveTeamReference } from './team-resolution';
import type { IrisTeamMember, IrisTeamMemberDetail } from './types';

function normalizeTeamMemberRecord(member: any): IrisTeamMember {
  return {
    ...member,
    member_id: member.member_id ?? member.membership_id,
    membership_id: member.membership_id ?? member.member_id,
  };
}

export async function getTeamMembersDetailed(teamRef: string): Promise<IrisTeamMemberDetail[]> {
  if (!irisSupa || !isIrisConfigured()) return [];
  const teamResult = await resolveTeamReference(
    { teamId: teamRef, teamName: teamRef },
    { allowSingleTeamDefault: false, missingMessage: 'No encontre el equipo solicitado para listar miembros.' },
  );
  if (!teamResult.success) return [];

  const { data: members, error } = await irisSupa
    .from('team_members')
    .select('*')
    .eq('team_id', teamResult.value.team_id)
    .eq('is_active', true);
  if (error || !members?.length) return [];

  const normalized = members.map(normalizeTeamMemberRecord);
  const userIds = Array.from(new Set(normalized.map((member) => member.user_id).filter(Boolean)));
  if (userIds.length === 0) return normalized;

  const { data: users } = await irisSupa.from('account_users').select('user_id, display_name, email, username').in('user_id', userIds);
  const byUserId = new Map((users || []).map((user: any) => [user.user_id, user]));
  return normalized.map((member) => {
    const user = byUserId.get(member.user_id);
    return { ...member, display_name: user?.display_name ?? null, email: user?.email ?? null, username: user?.username ?? null };
  });
}
