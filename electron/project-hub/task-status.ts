import { createHash } from 'node:crypto';
import { taskStageFor, taskStages } from '../../src/shared/task-workflow';
import { directData, directWrite, type DirectProjectContext, type ProjectRow } from './direct-context';
import { ProjectHubError } from './session-contract';

export async function canManageTaskStatuses(context: DirectProjectContext, project: ProjectRow) {
  if (!project.team_id) return false;
  const team = await directData(context.iris.from('teams').select('owner_id').eq('team_id', project.team_id).eq('workspace_id', context.workspace.id).eq('status', 'active').maybeSingle(), context);
  if (!team) return false;
  if (['owner', 'admin'].includes(context.role) || team.owner_id === context.actorId) return true;
  const member = await directData(context.iris.from('team_members').select('role').eq('team_id', project.team_id).eq('user_id', context.actorId).eq('is_active', true).maybeSingle(), context);
  return !!member && ['owner', 'admin'].includes(member.role);
}

/** Sólo la escritura confirmada puede materializar una fase que aún no existe. */
export async function resolveTaskStage(context: DirectProjectContext, project: ProjectRow, stage: string) {
  const statuses = await directData(context.iris.from('task_statuses').select('status_id,name,status_type,position').eq('team_id', project.team_id).order('position').limit(201), context);
  if ((statuses?.length ?? 0) > 200) throw new ProjectHubError('LIMIT_REACHED', 'Hay demasiados estados para resolver esta fase.');
  const existing = statuses?.find(status => taskStageFor(String(status.name), String(status.status_type)) === stage);
  if (existing) return String(existing.status_id);
  if (!await canManageTaskStatuses(context, project)) throw new ProjectHubError('PROJECT_FORBIDDEN', 'Pide a un administrador del equipo que configure esta fase.');
  const definition = taskStages.find(item => item.type === stage)!;
  // UUID estable por equipo y fase: los reintentos/concurrencia no duplican estados.
  const hex = createHash('sha256').update(`soflia/task-status/${project.team_id}/${stage}`).digest('hex');
  const statusId = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
  await directWrite(context.iris.from('task_statuses').upsert({ status_id: statusId, team_id: project.team_id, name: definition.name, status_type: stage === 'pending' ? 'todo' : stage, position: Math.max(-1, ...(statuses ?? []).map(row => Number(row.position) || 0)) + 1, is_default: !statuses?.length, is_closed: ['done', 'cancelled'].includes(stage) }, { onConflict: 'status_id', ignoreDuplicates: true }), context);
  return statusId;
}
