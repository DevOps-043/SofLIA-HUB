import { describeResolutionCandidates, resolveSearchCandidate } from '../../shared/iris-resolution';
import { getTeamMembersDetailed } from './team-members';
import type { IrisTeamMemberDetail, ResolveResult } from './types';
import { isUuidLike } from './uuid';

export async function resolveAssigneeReference(refs: {
  assigneeId?: string;
  assigneeQuery?: string;
  teamId: string;
}): Promise<ResolveResult<IrisTeamMemberDetail | null>> {
  const query = refs.assigneeQuery?.trim() || refs.assigneeId?.trim() || '';
  if (!query) return { success: true, value: null, warnings: [] };

  const members = await getTeamMembersDetailed(refs.teamId);
  if (!members.length) return { success: false, error: 'El equipo seleccionado no tiene miembros disponibles para asignacion.' };

  const explicitId = refs.assigneeId?.trim();
  if (explicitId) {
    const byId = members.find((member) => member.user_id === explicitId);
    if (byId) return { success: true, value: byId, warnings: [] };
    if (isUuidLike(explicitId) && !refs.assigneeQuery?.trim()) return { success: false, error: 'El usuario asignado no pertenece al equipo seleccionado.' };
  }

  const resolution = resolveSearchCandidate(
    query,
    members.map((member) => ({
      item: member,
      label: member.display_name || member.username || member.email || member.user_id,
      aliases: [member.username, member.email, member.email?.split('@')[0], member.user_id],
    })),
  );
  if (resolution.match) return { success: true, value: resolution.match, warnings: [] };
  if (resolution.reason === 'ambiguous') {
    return { success: false, error: `El responsable "${query}" es ambiguo dentro del equipo. Opciones: ${describeResolutionCandidates(resolution.candidates)}.` };
  }
  return { success: false, error: `No encontre a "${query}" dentro del equipo seleccionado.` };
}
