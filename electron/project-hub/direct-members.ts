import { z } from 'zod';
import { directData, directWrite, type DirectProjectContext, type ProjectRow } from './direct-context';
import { directAdmin } from './direct-resources';
import { ProjectHubError } from './session-contract';

export async function directProjectMember(context: DirectProjectContext, project: ProjectRow, memberId: string | undefined, method: string, body: ProjectRow) {
  directAdmin(project);
  const role = method === 'DELETE' ? undefined : z.enum(['owner', 'admin', 'member', 'viewer', 'guest']).parse(body.role);
  // La titularidad se conserva en created_by_user_id; no se transfiere mediante una membresía.
  if (role === 'owner') throw new ProjectHubError('OWNER_PROTECTED', 'La titularidad del proyecto no se cambia desde los colaboradores.');
  if (method === 'POST') {
    const userId = z.string().uuid().parse(body.user_id);
    const member = await directData(context.iris.from('workspace_members').select('user_id').eq('workspace_id', context.workspace.id).eq('user_id', userId).eq('is_active', true).maybeSingle(), context);
    if (!member) throw new ProjectHubError('INVALID_REFERENCE', 'La persona no pertenece a esta organización.');
    if (userId === project.created_by_user_id) throw new ProjectHubError('OWNER_PROTECTED', 'La persona ya es propietaria del proyecto.');
    return { data: await directWrite(context.iris.from('pm_project_members').upsert({ project_id: project.project_id, user_id: userId, project_role: role, membership_status: 'active', can_edit: role === 'admin' || role === 'member', can_manage_members: role === 'admin', can_manage_settings: role === 'admin', can_delete: false, invited_by_user_id: context.actorId }, { onConflict: 'project_id,user_id' }).select('*').single(), context) };
  }
  const current = await directData(context.iris.from('pm_project_members').select('member_id,user_id,project_role').eq('project_id', project.project_id).eq('member_id', memberId).eq('membership_status', 'active').maybeSingle(), context);
  if (!current) throw new ProjectHubError('NOT_FOUND', 'No se encontró el integrante del proyecto.');
  if (current.user_id === project.created_by_user_id || current.project_role === 'owner') throw new ProjectHubError('OWNER_PROTECTED', 'No puedes retirar ni cambiar al propietario del proyecto.');
  const updates = method === 'DELETE' ? { membership_status: 'removed', removed_at: new Date().toISOString(), removed_by_user_id: context.actorId } : { project_role: role, can_edit: role === 'admin' || role === 'member', can_manage_members: role === 'admin', can_manage_settings: role === 'admin' };
  return { data: await directWrite(context.iris.from('pm_project_members').update(updates).eq('project_id', project.project_id).eq('member_id', memberId).eq('membership_status', 'active').select('*').single(), context) };
}

export async function directTeamMutation(context: DirectProjectContext, project: ProjectRow, teamId: string | undefined, memberId: string | undefined, method: string, body: ProjectRow) {
  directAdmin(project);
  const iris = context.iris;
  if (!teamId && method === 'PATCH') {
    const id = z.string().uuid().parse(body.teamId);
    const team = await directData(iris.from('teams').select('team_id,visibility,owner_id').eq('workspace_id', context.workspace.id).eq('team_id', id).eq('status', 'active').maybeSingle(), context);
    if (!team) throw new ProjectHubError('INVALID_REFERENCE', 'El equipo no pertenece a esta organización.');
    if (team.visibility === 'private' && team.owner_id !== context.actorId && !['owner', 'admin'].includes(context.role)) {
      const member = await directData(iris.from('team_members').select('member_id').eq('team_id', id).eq('user_id', context.actorId).eq('is_active', true).maybeSingle(), context);
      if (!member) throw new ProjectHubError('PROJECT_FORBIDDEN', 'No tienes acceso al equipo privado.');
    }
    if (body.expectedUpdatedAt && body.expectedUpdatedAt !== project.updated_at) throw new ProjectHubError('CONFLICT', 'El proyecto cambió. Actualiza antes de asignar el equipo.');
    if (project.team_id !== id) {
      const task = await directData(iris.from('task_issues').select('issue_id').eq('project_id', project.project_id).limit(1), context);
      if (task?.length) throw new ProjectHubError('PROJECT_HAS_TASKS', 'No se cambia el equipo de un proyecto que ya tiene tareas.');
    }
    return { data: await directWrite(iris.from('pm_projects').update({ team_id: id, updated_at: new Date().toISOString() }).eq('workspace_id', context.workspace.id).eq('project_id', project.project_id).eq('updated_at', project.updated_at).select('*').single(), context) };
  }
  if (!teamId && method === 'POST') {
    if (!['owner', 'admin'].includes(context.role)) throw new ProjectHubError('WORKSPACE_FORBIDDEN', 'Sólo quien administra la organización puede crear equipos.');
    const { teamFields } = await import('../../src/shared/project-management');
    const input = teamFields.parse(body.team);
    if (project.team_id) throw new ProjectHubError('CONFLICT', 'El proyecto ya tiene equipo. Actualiza su configuración antes de crear otro.');
    const team = await directWrite(iris.from('teams').insert({ ...input, slug: `equipo-${crypto.randomUUID()}`, workspace_id: context.workspace.id, owner_id: context.actorId, status: 'active' }).select('*').single(), context);
    await directWrite(iris.from('pm_projects').update({ team_id: team.team_id, updated_at: new Date().toISOString() }).eq('workspace_id', context.workspace.id).eq('project_id', project.project_id).eq('updated_at', project.updated_at).select('project_id').single(), context);
    return { data: team };
  }
  if (teamId !== project.team_id) throw new ProjectHubError('INVALID_REFERENCE', 'El equipo no está asignado al proyecto.');
  const team = await directData(iris.from('teams').select('team_id,owner_id,max_members,updated_at').eq('workspace_id', context.workspace.id).eq('team_id', teamId).eq('status', 'active').maybeSingle(), context);
  if (!team) throw new ProjectHubError('NOT_FOUND', 'El equipo no está disponible.');
  const manager = team.owner_id === context.actorId || ['owner', 'admin'].includes(context.role);
  if (!manager) {
    const member = await directData(iris.from('team_members').select('role').eq('team_id', teamId).eq('user_id', context.actorId).eq('is_active', true).maybeSingle(), context);
    if (!member || !['owner', 'admin'].includes(member.role)) throw new ProjectHubError('PROJECT_FORBIDDEN', 'No tienes permiso para administrar el equipo.');
  }
  if (body.updates) {
    const { teamFields } = await import('../../src/shared/project-management');
    const updates = teamFields.partial().parse(body.updates);
    if (body.expectedUpdatedAt && body.expectedUpdatedAt !== team.updated_at) throw new ProjectHubError('CONFLICT', 'El equipo cambió. Actualiza antes de repetir.');
    return { data: await directWrite(iris.from('teams').update({ ...updates, updated_at: new Date().toISOString() }).eq('workspace_id', context.workspace.id).eq('team_id', teamId).eq('updated_at', team.updated_at).select('*').single(), context) };
  }
  const role = method === 'DELETE' ? undefined : z.enum(['admin', 'moderator', 'member', 'viewer']).parse(body.role);
  if (!memberId) {
    const userId = z.string().uuid().parse(body.userId);
    const active = await directData(iris.from('workspace_members').select('user_id').eq('workspace_id', context.workspace.id).eq('user_id', userId).eq('is_active', true).maybeSingle(), context);
    if (!active) throw new ProjectHubError('INVALID_REFERENCE', 'La persona no pertenece a esta organización.');
    if (team.owner_id === userId) throw new ProjectHubError('OWNER_PROTECTED', 'La persona ya es propietaria del equipo.');
    const members = await directData(iris.from('team_members').select('member_id').eq('team_id', teamId).eq('is_active', true).limit(1001), context);
    if ((members?.length ?? 0) >= Number(team.max_members ?? 1000)) throw new ProjectHubError('TEAM_FULL', 'El equipo alcanzó su límite de integrantes.');
    return { data: await directWrite(iris.from('team_members').upsert({ team_id: teamId, user_id: userId, role, is_active: true, invited_by: context.actorId }, { onConflict: 'team_id,user_id' }).select('*').single(), context) };
  }
  const member = await directData(iris.from('team_members').select('member_id,user_id,role').eq('team_id', teamId).eq('member_id', memberId).eq('is_active', true).maybeSingle(), context);
  if (!member) throw new ProjectHubError('NOT_FOUND', 'No se encontró el integrante del equipo.');
  if (member.user_id === team.owner_id || member.role === 'owner') throw new ProjectHubError('OWNER_PROTECTED', 'No se modifica al propietario del equipo desde sus integrantes.');
  return { data: await directWrite(iris.from('team_members').update(method === 'DELETE' ? { is_active: false } : { role }).eq('team_id', teamId).eq('member_id', memberId).select('*').single(), context) };
}
