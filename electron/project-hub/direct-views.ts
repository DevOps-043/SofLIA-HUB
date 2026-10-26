import { directData, type DirectProjectContext, type ProjectRow } from './direct-context';
import { directPage } from './direct-projects';
import { ProjectHubError } from './session-contract';
import { taskDifficulty } from '../../src/shared/task-difficulty';

export async function directTaskOptions(context: DirectProjectContext, project: ProjectRow) {
  const iris = context.iris;
  const priorities = await directData(iris.from('task_priorities').select('*').order('level').limit(100), context);
  const workspaceMembers = await directData(iris.from('workspace_members').select('user_id,iris_role,user:account_users(user_id,display_name,email,avatar_url)').eq('workspace_id', context.workspace.id).eq('is_active', true).limit(1001), context);
  if ((workspaceMembers?.length ?? 0) > 1000) throw new ProjectHubError('LIMIT_REACHED', 'Hay demasiados integrantes para cargar este selector.');
  const projectMembers = await directData(iris.from('pm_project_members').select('user_id,project_role').eq('project_id', project.project_id).eq('membership_status', 'active').limit(1001), context);
  const users = new Set([project.created_by_user_id, ...(projectMembers ?? []).map(row => row.user_id)]);
  const members = (workspaceMembers ?? []).filter(row => users.has(row.user_id));
  const statuses = project.team_id ? await directData(iris.from('task_statuses').select('*').eq('team_id', project.team_id).order('position').limit(200), context) : [];
  const labels = project.team_id ? await directData(iris.from('task_labels').select('*').eq('team_id', project.team_id).order('name').limit(500), context) : [];
  const cycles = project.team_id ? await directData(iris.from('task_cycles').select('*').eq('team_id', project.team_id).order('start_date', { ascending: false }).limit(200), context) : [];
  return { data: { statuses: statuses ?? [], priorities: priorities ?? [], labels: labels ?? [], cycles: cycles ?? [], assignees: members, can_manage_labels: ['owner', 'admin'].includes(String(project.role)) } };
}
export async function directTeamView(context: DirectProjectContext, project: ProjectRow) {
  const teams = await directData(context.iris.from('teams').select('*').eq('workspace_id', context.workspace.id).eq('status', 'active').order('name').limit(501), context);
  if ((teams?.length ?? 0) > 500) throw new ProjectHubError('LIMIT_REACHED', 'Hay demasiados equipos para cargar este selector.');
  const ownTeams = await directData(context.iris.from('team_members').select('team_id,role').eq('user_id', context.actorId).eq('is_active', true).limit(1001), context);
  if ((ownTeams?.length ?? 0) > 1000) throw new ProjectHubError('LIMIT_REACHED', 'Hay demasiadas membresías de equipo para cargar esta vista.');
  const admin = ['owner', 'admin'].includes(context.role);
  const visible = (teams ?? []).filter(row => admin || row.visibility !== 'private' || row.owner_id === context.actorId || ownTeams?.some(member => member.team_id === row.team_id));
  const team = visible.find(row => row.team_id === project.team_id) ?? null;
  const members = team ? await directData(context.iris.from('team_members').select('*,user:account_users(user_id,display_name,email,avatar_url)').eq('team_id', team.team_id).eq('is_active', true).limit(1001), context) : [];
  const manager = admin || team?.owner_id === context.actorId || ownTeams?.some(row => row.team_id === team?.team_id && ['owner', 'admin'].includes(row.role)) === true;
  const directory = ['owner', 'admin'].includes(String(project.role)) ? await directData(context.iris.from('workspace_members').select('user_id,user:account_users(user_id,display_name,email,avatar_url)').eq('workspace_id', context.workspace.id).eq('is_active', true).limit(1001), context) : [];
  return { data: { team, members: (members ?? []).slice(0, 1000), available: visible, directory: (directory ?? []).slice(0, 1000), restricted: !!project.team_id && !team, workspace_role: context.role, can_manage: manager, can_create: admin, partial: (members?.length ?? 0) > 1000 || (directory?.length ?? 0) > 1000 } };
}
export async function directAnalytics(context: DirectProjectContext, projectId: string) {
  const tasks = await directData(context.iris.from('task_issues').select('issue_id,due_date,assignee_id,task_statuses(status_type,is_closed),task_priorities(level)').eq('project_id', projectId).is('archived_at', null).limit(5001), context) as ProjectRow[] | null;
  const evidence = await directData(context.iris.from('pm_project_evidence').select('evidence_id,evidence_type,pm_project_evidence_items(item_type)').eq('workspace_id', context.workspace.id).eq('project_id', projectId).is('archived_at', null).limit(5001), context) as ProjectRow[] | null;
  if ((tasks?.length ?? 0) > 5000 || (evidence?.length ?? 0) > 5000) throw new ProjectHubError('LIMIT_REACHED', 'No se pueden calcular totales completos con este volumen de datos.');
  const statuses: Record<string, number> = {}; const priorities: Record<string, number> = {}; const workload: Record<string, number> = {}; const items: Record<string, number> = {};
  let completed = 0; let overdue = 0;
  const today = new Date().toISOString().slice(0, 10);
  for (const task of tasks ?? []) {
    const status = (Array.isArray(task.task_statuses) ? task.task_statuses[0] : task.task_statuses) as ProjectRow | null;
    const priority = (Array.isArray(task.task_priorities) ? task.task_priorities[0] : task.task_priorities) as ProjectRow | null;
    const key = String(status?.status_type ?? 'unknown'); statuses[key] = (statuses[key] ?? 0) + 1;
    const level = String(priority?.level ?? 'none'); priorities[level] = (priorities[level] ?? 0) + 1;
    if (status?.is_closed) completed++;
    if (typeof task.due_date === 'string' && task.due_date < today && !status?.is_closed) overdue++;
    if (task.assignee_id) workload[String(task.assignee_id)] = (workload[String(task.assignee_id)] ?? 0) + 1;
  }
  for (const row of evidence ?? []) for (const entry of Array.isArray(row.pm_project_evidence_items) ? row.pm_project_evidence_items : []) { const key = String((entry as ProjectRow).item_type); items[key] = (items[key] ?? 0) + 1; }
  const activity = await directData(context.iris.from('pm_project_activity').select('*').eq('workspace_id', context.workspace.id).eq('project_id', projectId).order('created_at', { ascending: false }).limit(25), context);
  return { data: { progress: tasks?.length ? Math.round(completed / tasks.length * 100) : 0, tasks: { total: tasks?.length ?? 0, completed, overdue, by_status: statuses, by_priority: priorities, workload }, evidence: { total: evidence?.length ?? 0, meetings: evidence?.filter(row => row.evidence_type === 'meeting').length ?? 0, decisions: items.decision ?? 0, agreements: items.agreement ?? 0, by_item_type: items }, recent_activity: activity ?? [] } };
}
export async function directReadCollection(context: DirectProjectContext, projectId: string, collection: string, params: URLSearchParams) {
  if (collection === 'tasks') {
    let query = context.iris.from('task_issues').select('*,task_statuses(status_id,name,status_type,color,is_closed),assignee:account_users!task_issues_assignee_id_fkey(user_id,display_name,avatar_url),task_issue_labels(label_id,task_labels(*))').eq('project_id', projectId).is('archived_at', null).order('created_at', { ascending: false }).order('issue_id');
    for (const [key, field] of [['statusId', 'status_id'], ['assigneeId', 'assignee_id'], ['priorityId', 'priority_id'], ['cycleId', 'cycle_id']] as const) { const value = params.get(key); if (value) query = query.eq(field, value); }
    const difficulty = params.get('difficulty');
    if (difficulty) {
      const level = taskDifficulty.parse(difficulty);
      if (level === 'unestimated') query = query.is('estimate_points', null);
      else if (level === 'low') query = query.lte('estimate_points', 2);
      else if (level === 'medium') query = query.gt('estimate_points', 2).lte('estimate_points', 5);
      else query = query.gt('estimate_points', 5);
    }
    return directPage(query, context, params, 'title');
  }
  if (collection === 'members') {
    const page = await directPage(context.iris.from('pm_project_members').select('*,user:account_users(user_id,display_name,email,avatar_url)').eq('project_id', projectId).eq('membership_status', 'active').order('joined_at').order('member_id'), context, params);
    const project = await directData(context.iris.from('pm_projects').select('created_by_user_id,created_at').eq('workspace_id', context.workspace.id).eq('project_id', projectId).single(), context);
    if (!project) throw new ProjectHubError('NOT_FOUND', 'El proyecto ya no está disponible.');
    if (!params.get('cursor') && !page.data.some(row => row.user_id === project.created_by_user_id)) {
      const user = await directData(context.iris.from('account_users').select('user_id,display_name,email,avatar_url').eq('user_id', project.created_by_user_id).maybeSingle(), context);
      if (user) page.data.unshift({ member_id: `owner:${String(project.created_by_user_id)}`, user_id: project.created_by_user_id, project_role: 'owner', joined_at: project.created_at, user });
    }
    return page;
  }
  if (collection === 'milestones') return directPage(context.iris.from('pm_milestones').select('*').eq('project_id', projectId).order('sort_order').order('milestone_id'), context, params, 'milestone_name');
  if (collection === 'documents') return directPage(context.iris.from('pm_project_documents').select('*').eq('project_id', projectId).order('created_at', { ascending: false }).order('id'), context, params, 'name');
  if (collection === 'evidence') return directPage(context.iris.from('pm_project_evidence').select('*,pm_project_evidence_items(*)').eq('workspace_id', context.workspace.id).eq('project_id', projectId).is('archived_at', null).order('created_at', { ascending: false }).order('evidence_id'), context, params, 'title');
  throw new ProjectHubError('INVALID_PAYLOAD', 'Colección de proyectos desconocida.');
}
