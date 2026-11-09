import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { projectHubProjectCreate, projectHubProjectUpdate } from '../../src/shared/project-hub';
import { directData, directWrite, directProject, type DirectProjectContext, type ProjectRow } from './direct-context';
import { ProjectHubError } from './session-contract';

export type DirectQuery = ReturnType<ReturnType<DirectProjectContext['iris']['from']>['select']>;
export async function directPage(query: DirectQuery, context: DirectProjectContext, params: URLSearchParams, field?: string) {
  const raw = params.get('cursor') ?? '0';
  if (!/^\d{1,7}$/u.test(raw)) throw new ProjectHubError('INVALID_PAYLOAD', 'La página de proyectos no es válida.');
  const offset = Number(raw);
  const search = params.get('search');
  if (search && field) query = query.ilike(field, `%${search.replace(/[%_\\]/g, '\\$&')}%`);
  const rows = await directData(query.range(offset, offset + 100), context) as ProjectRow[] | null;
  return { data: (rows ?? []).slice(0, 100), meta: { has_more: (rows?.length ?? 0) > 100, next_cursor: (rows?.length ?? 0) > 100 ? String(offset + 100) : null } };
}
export async function directProjectCollection(context: DirectProjectContext, method: string, body: unknown, params: URLSearchParams) {
  if (method === 'GET') {
    let memberships: ProjectRow[] = [];
    let query = context.iris.from('pm_projects').select('*').eq('workspace_id', context.workspace.id).is('archived_at', null).order('updated_at', { ascending: false }).order('project_id');
    if (!['owner', 'admin'].includes(context.role)) {
      memberships = await directData(context.iris.from('pm_project_members').select('project_id,project_role').eq('user_id', context.actorId).eq('membership_status', 'active').limit(5001), context) ?? [];
      if ((memberships?.length ?? 0) > 5000) throw new ProjectHubError('LIMIT_REACHED', 'Hay demasiadas membresías para cargar esta lista. Refina la selección.');
      const ids = (memberships ?? []).map(row => z.string().uuid().parse(row.project_id));
      query = ids.length ? query.or(`created_by_user_id.eq.${context.actorId},project_id.in.(${ids.join(',')})`) : query.eq('created_by_user_id', context.actorId);
    }
    const page = await directPage(query, context, params, 'project_name');
    const roles = new Map(memberships.map(member => [member.project_id, member.project_role]));
    return { ...page, data: page.data.flatMap(project => {
      // Mismo orden de autoridad que directProject, sin consultar un detalle por fila.
      const role = ['owner', 'admin'].includes(context.role) ? 'admin' : project.created_by_user_id === context.actorId ? 'owner' : roles.get(project.project_id);
      return typeof role === 'string' ? [{ ...project, role, membership: { project_role: role } }] : [];
    }) };
  }
  if (method !== 'POST') throw new ProjectHubError('INVALID_PAYLOAD', 'Operación de proyectos inválida.');
  const input = projectHubProjectCreate.parse(body);
  if (input.team_id) {
    const team = await directData(context.iris.from('teams').select('team_id').eq('workspace_id', context.workspace.id).eq('team_id', input.team_id).eq('status', 'active').maybeSingle(), context);
    if (!team) throw new ProjectHubError('INVALID_REFERENCE', 'El equipo no está activo en esta organización.');
  }
  if (input.lead_user_id && input.lead_user_id !== context.actorId) {
    const member = await directData(context.iris.from('workspace_members').select('user_id').eq('workspace_id', context.workspace.id).eq('user_id', input.lead_user_id).eq('is_active', true).maybeSingle(), context);
    if (!member) throw new ProjectHubError('INVALID_REFERENCE', 'La persona responsable no pertenece a este espacio.');
  }
  await context.check();
  const prefix = input.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/gi, '').slice(0, 5).toUpperCase() || 'PROY';
  const project = await directWrite(context.iris.from('pm_projects').insert({
    workspace_id: context.workspace.id, team_id: input.team_id ?? null, project_id: randomUUID(),
    project_name: input.name, project_key: `${prefix}-${randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`,
    project_description: input.description ?? null, priority_level: input.priority ?? 'medium',
    start_date: input.start_date ?? null, target_date: input.target_date ?? null, tags: input.tags ?? [],
    created_by_user_id: context.actorId, lead_user_id: input.lead_user_id ?? context.actorId,
    project_status: 'planning', health_status: 'none', completion_percentage: 0, is_public: false, is_template: false,
  }).select('*').single(), context);
  if (!project || project.workspace_id !== context.workspace.id || project.created_by_user_id !== context.actorId) throw new ProjectHubError('INVALID_RESPONSE', 'No se pudo comprobar el proyecto creado.');
  // La propiedad queda en la misma escritura que el proyecto; no exige un segundo INSERT para abrirlo.
  return { data: { ...project, role: 'owner', membership: { project_role: 'owner' } } };
}
export async function directProjectRecord(context: DirectProjectContext, projectId: string, method: string, body: unknown) {
  const current = await directProject(context, context.workspace.id, projectId, method === 'GET' ? 'read' : 'admin');
  if (method === 'GET') return { data: current };
  if (method !== 'PATCH') throw new ProjectHubError('INVALID_PAYLOAD', 'Operación de proyecto inválida.');
  const updates = projectHubProjectUpdate.parse(body);
  if (updates.lead_user_id) {
    const member = await directData(context.iris.from('workspace_members').select('user_id').eq('workspace_id', context.workspace.id).eq('user_id', updates.lead_user_id).eq('is_active', true).maybeSingle(), context);
    if (!member) throw new ProjectHubError('INVALID_REFERENCE', 'La persona responsable no pertenece a este espacio.');
  }
  const fields: Record<string, string> = { name: 'project_name', description: 'project_description', priority: 'priority_level', status: 'project_status', health: 'health_status' };
  const values = Object.fromEntries(Object.entries(updates).map(([key, value]) => [fields[key] ?? key, value]));
  if (updates.status === 'archived') values.archived_at = new Date().toISOString();
  return { data: await directWrite(context.iris.from('pm_projects').update(values).eq('workspace_id', context.workspace.id).eq('project_id', projectId).eq('updated_at', current.updated_at).select('*').single(), context) };
}
