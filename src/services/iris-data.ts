import {
  irisSupa,
  isIrisConfigured,
  type IrisIssue,
  type IrisPriority,
  type IrisProject,
  type IrisStatus,
  type IrisTeam,
} from '../lib/iris-client';
import { isSofiaConfigured, sofiaSupa } from '../lib/sofia-client';
import {
  describeResolutionCandidates,
  generateUniqueProjectKey,
  normalizeProjectKey,
  resolveSearchCandidate,
} from '../shared/iris-resolution';
import { sofiaAuth } from './sofia-auth';

interface IrisTeamMember {
  member_id: string;
  membership_id?: string;
  team_id: string;
  user_id: string;
  role: string;
  joined_at: string;
  is_active?: boolean;
}

export interface IrisTeamMemberDetail extends IrisTeamMember {
  display_name?: string | null;
  email?: string | null;
  username?: string | null;
}

type ResolveResult<T> =
  | { success: true; value: T; warnings: string[] }
  | { success: false; error: string };

const IRIS_KEYWORDS = [
  'proyecto', 'proyectos', 'project', 'projects',
  'issue', 'issues', 'tarea', 'tareas', 'task', 'tasks',
  'equipo', 'equipos', 'team', 'teams',
  'prioridad', 'priority', 'asignar', 'assignee', 'responsable',
  'project hub', 'iris', 'crear proyecto', 'crear tarea',
  'create project', 'create task', 'mis tareas', 'my tasks',
];

function isUuidLike(value: string | null | undefined): boolean {
  return !!value && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value.trim());
}

function normalizeTeamMemberRecord(member: any): IrisTeamMember {
  return {
    ...member,
    member_id: member.member_id ?? member.membership_id,
    membership_id: member.membership_id ?? member.member_id,
  };
}

async function ensureUserExistsInIris(userId: string): Promise<void> {
  if (!irisSupa || !isIrisConfigured() || !sofiaSupa || !isSofiaConfigured()) return;
  try {
    const { data: existing } = await irisSupa
      .from('account_users')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle();
    if (existing) return;

    const { data: sofiaUser, error } = await sofiaSupa
      .from('users')
      .select('id, username, email, first_name, last_name, display_name, phone, profile_picture_url')
      .eq('id', userId)
      .maybeSingle();
    if (error || !sofiaUser) return;

    const lastNameParts = (sofiaUser.last_name || '').trim().split(/\s+/).filter(Boolean);
    const payload = {
      user_id: sofiaUser.id,
      first_name: sofiaUser.first_name || sofiaUser.username,
      last_name_paternal: lastNameParts[0] || sofiaUser.username,
      last_name_maternal: lastNameParts.length > 1 ? lastNameParts.slice(1).join(' ') : null,
      display_name:
        sofiaUser.display_name ||
        `${sofiaUser.first_name || ''} ${sofiaUser.last_name || ''}`.trim() ||
        sofiaUser.username,
      username: sofiaUser.username,
      email: sofiaUser.email,
      password_hash: 'SOFIA_MANAGED_AUTH',
      permission_level: 'user',
      account_status: 'active',
      is_email_verified: true,
      phone_number: sofiaUser.phone || null,
      avatar_url: sofiaUser.profile_picture_url || null,
    };

    const { error: upsertError } = await irisSupa
      .from('account_users')
      .upsert(payload, { onConflict: 'user_id', ignoreDuplicates: true });

    if (upsertError && upsertError.code !== '23505') {
      console.error('IRIS: ensureUserExistsInIris upsert failed', upsertError);
    }
  } catch (err) {
    console.error('IRIS: ensureUserExistsInIris exception', err);
  }
}

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

async function resolveTeamReference(
  refs: { teamId?: string; teamName?: string },
  options?: { allowSingleTeamDefault?: boolean; missingMessage?: string },
): Promise<ResolveResult<IrisTeam>> {
  const teams = await getTeams();
  if (teams.length === 0) return { success: false, error: 'IRIS no tiene equipos disponibles.' };

  const explicitId = refs.teamId?.trim();
  if (explicitId) {
    const byId = teams.find((team) => team.team_id === explicitId);
    if (byId) return { success: true, value: byId, warnings: [] };
    if (isUuidLike(explicitId) && !refs.teamName?.trim()) {
      return { success: false, error: `No existe el equipo con ID ${explicitId}.` };
    }
  }

  const query = refs.teamName?.trim() || refs.teamId?.trim() || '';
  if (query) {
    const resolution = resolveSearchCandidate(
      query,
      teams.map((team) => ({ item: team, label: team.name, aliases: [team.slug, team.description] })),
    );
    if (resolution.match) return { success: true, value: resolution.match, warnings: [] };
    if (resolution.reason === 'ambiguous') {
      return { success: false, error: `El equipo "${query}" es ambiguo. Opciones: ${describeResolutionCandidates(resolution.candidates)}.` };
    }
    return { success: false, error: options?.missingMessage || `No encontre el equipo "${query}" en IRIS.` };
  }

  if (options?.allowSingleTeamDefault && teams.length === 1) {
    return { success: true, value: teams[0], warnings: [`Se uso el unico equipo activo disponible: ${teams[0].name}.`] };
  }

  return { success: false, error: options?.missingMessage || 'Debes indicar el equipo objetivo antes de escribir en IRIS.' };
}

export async function getProjects(teamRef?: string): Promise<IrisProject[]> {
  try {
    if (!irisSupa || !isIrisConfigured()) return [];
    let resolvedTeamId: string | null = null;
    if (teamRef?.trim()) {
      const teamResult = await resolveTeamReference(
        { teamId: teamRef, teamName: teamRef },
        { allowSingleTeamDefault: false, missingMessage: 'No encontre el equipo solicitado para filtrar proyectos.' },
      );
      if (!teamResult.success) return [];
      resolvedTeamId = teamResult.value.team_id;
    }
    let query = irisSupa.from('pm_projects').select('*').order('updated_at', { ascending: false });
    if (resolvedTeamId) query = query.eq('team_id', resolvedTeamId);
    const { data, error } = await query;
    if (error) return [];
    return (data || []) as IrisProject[];
  } catch {
    return [];
  }
}

export async function deleteProject(projectId: string): Promise<{ success: boolean; error?: string }> {
  try {
    if (!irisSupa || !isIrisConfigured()) return { success: false, error: 'Database not configured' };
    await irisSupa.from('task_issues').delete().eq('project_id', projectId);
    await irisSupa.from('pm_project_members').delete().eq('project_id', projectId);
    await irisSupa.from('project_members').delete().eq('project_id', projectId);
    const { error } = await irisSupa.from('pm_projects').delete().eq('project_id', projectId);
    return error ? { success: false, error: error.message } : { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
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

  const { data: users } = await irisSupa
    .from('account_users')
    .select('user_id, display_name, email, username')
    .in('user_id', userIds);
  const byUserId = new Map((users || []).map((user: any) => [user.user_id, user]));
  return normalized.map((member) => {
    const user = byUserId.get(member.user_id);
    return { ...member, display_name: user?.display_name ?? null, email: user?.email ?? null, username: user?.username ?? null };
  });
}

async function resolveProjectReference(refs: {
  projectId?: string;
  projectName?: string;
  scopedTeamId?: string;
}): Promise<ResolveResult<IrisProject | null>> {
  const query = refs.projectName?.trim() || refs.projectId?.trim() || '';
  if (!query) return { success: true, value: null, warnings: [] };

  const projects = await getProjects(refs.scopedTeamId);
  if (projects.length === 0) return { success: false, error: 'No hay proyectos disponibles en el alcance seleccionado.' };

  const explicitId = refs.projectId?.trim();
  if (explicitId) {
    const byId = projects.find((project) => project.project_id === explicitId);
    if (byId) return { success: true, value: byId, warnings: [] };
    if (isUuidLike(explicitId) && !refs.projectName?.trim()) {
      return { success: false, error: `No existe el proyecto con ID ${explicitId}.` };
    }
  }

  const resolution = resolveSearchCandidate(
    query,
    projects.map((project) => ({ item: project, label: project.project_name, aliases: [project.project_key, project.project_description] })),
  );
  if (resolution.match) return { success: true, value: resolution.match, warnings: [] };
  if (resolution.reason === 'ambiguous') {
    return { success: false, error: `El proyecto "${query}" es ambiguo. Opciones: ${describeResolutionCandidates(resolution.candidates)}.` };
  }
  return { success: false, error: `No encontre el proyecto "${query}" en IRIS.` };
}

export async function getIssues(filters?: {
  teamId?: string;
  projectId?: string;
  assigneeId?: string;
  limit?: number;
}): Promise<IrisIssue[]> {
  try {
    if (!irisSupa || !isIrisConfigured()) return [];
    let query = irisSupa
      .from('task_issues')
      .select('*, status:task_statuses(*), priority:task_priorities(*)')
      .is('archived_at', null)
      .order('updated_at', { ascending: false });
    if (filters?.teamId) query = query.eq('team_id', filters.teamId);
    if (filters?.projectId) query = query.eq('project_id', filters.projectId);
    if (filters?.assigneeId) query = query.eq('assignee_id', filters.assigneeId);
    query = query.limit(filters?.limit || 20);
    const { data, error } = await query;
    if (error) return [];
    return (data || []) as IrisIssue[];
  } catch {
    return [];
  }
}

async function getNextIssueNumber(teamId: string): Promise<number> {
  if (!irisSupa || !isIrisConfigured()) return 1;
  const { data } = await irisSupa
    .from('task_issues')
    .select('issue_number')
    .eq('team_id', teamId)
    .order('issue_number', { ascending: false })
    .limit(1);
  return data && data.length > 0 ? data[0].issue_number + 1 : 1;
}

function buildStatusAliases(status: IrisStatus): string[] {
  const aliases = [status.name, status.status_type];
  if (status.status_type === 'todo') aliases.push('to do', 'pendiente', 'por hacer');
  if (status.status_type === 'in_progress') aliases.push('en progreso', 'doing');
  if (status.status_type === 'in_review') aliases.push('revision', 'review', 'en revision');
  if (status.status_type === 'done') aliases.push('hecho', 'completado', 'completed');
  if (status.status_type === 'backlog') aliases.push('por definir');
  if (status.status_type === 'cancelled') aliases.push('cancelado');
  return aliases;
}

function buildPriorityAliases(priority: IrisPriority): string[] {
  const normalized = priority.name.toLowerCase();
  const aliases = [priority.name];
  if (normalized.includes('urgente')) aliases.push('urgent', 'critical');
  if (normalized.includes('alta')) aliases.push('high');
  if (normalized.includes('media')) aliases.push('medium');
  if (normalized.includes('baja')) aliases.push('low');
  if (normalized.includes('sin prioridad')) aliases.push('none', 'no priority');
  return aliases;
}

export async function getStatuses(teamRef: string): Promise<IrisStatus[]> {
  if (!irisSupa || !isIrisConfigured()) return [];
  const teamResult = await resolveTeamReference(
    { teamId: teamRef, teamName: teamRef },
    { allowSingleTeamDefault: false, missingMessage: 'No encontre el equipo solicitado para listar estados.' },
  );
  if (!teamResult.success) return [];
  const { data, error } = await irisSupa.from('task_statuses').select('*').eq('team_id', teamResult.value.team_id).order('position');
  if (error) return [];
  return data || [];
}

async function resolveStatusReference(refs: { statusId?: string; statusName?: string; teamId: string }): Promise<ResolveResult<IrisStatus>> {
  const statuses = await getStatuses(refs.teamId);
  if (!statuses.length) return { success: false, error: 'El equipo no tiene estados configurados en IRIS.' };
  const explicitId = refs.statusId?.trim();
  if (explicitId) {
    const byId = statuses.find((status) => status.status_id === explicitId);
    if (byId) return { success: true, value: byId, warnings: [] };
    if (isUuidLike(explicitId) && !refs.statusName?.trim()) return { success: false, error: `No existe el estado con ID ${explicitId}.` };
  }
  const query = refs.statusName?.trim() || refs.statusId?.trim() || '';
  if (!query) {
    const fallback = statuses.find((status) => status.is_default) || statuses.find((status) => status.status_type === 'backlog') || statuses.find((status) => status.status_type === 'todo') || statuses[0];
    return { success: true, value: fallback, warnings: [] };
  }
  const resolution = resolveSearchCandidate(query, statuses.map((status) => ({ item: status, label: status.name, aliases: buildStatusAliases(status) })));
  if (resolution.match) return { success: true, value: resolution.match, warnings: [] };
  if (resolution.reason === 'ambiguous') {
    return { success: false, error: `El estado "${query}" es ambiguo. Opciones: ${describeResolutionCandidates(resolution.candidates)}.` };
  }
  return { success: false, error: `No encontre el estado "${query}" para el equipo seleccionado.` };
}

export async function getPriorities(): Promise<IrisPriority[]> {
  if (!irisSupa || !isIrisConfigured()) return [];
  const { data, error } = await irisSupa.from('task_priorities').select('*').order('level');
  if (error) return [];
  return data || [];
}

async function resolvePriorityReference(refs: { priorityId?: string; priorityName?: string }): Promise<ResolveResult<IrisPriority | null>> {
  const query = refs.priorityName?.trim() || refs.priorityId?.trim() || '';
  if (!query) return { success: true, value: null, warnings: [] };
  const priorities = await getPriorities();
  if (!priorities.length) return { success: false, error: 'IRIS no tiene prioridades configuradas.' };
  const explicitId = refs.priorityId?.trim();
  if (explicitId) {
    const byId = priorities.find((priority) => priority.priority_id === explicitId);
    if (byId) return { success: true, value: byId, warnings: [] };
    if (isUuidLike(explicitId) && !refs.priorityName?.trim()) return { success: false, error: `No existe la prioridad con ID ${explicitId}.` };
  }
  const resolution = resolveSearchCandidate(query, priorities.map((priority) => ({ item: priority, label: priority.name, aliases: buildPriorityAliases(priority) })));
  if (resolution.match) return { success: true, value: resolution.match, warnings: [] };
  if (resolution.reason === 'ambiguous') {
    return { success: false, error: `La prioridad "${query}" es ambigua. Opciones: ${describeResolutionCandidates(resolution.candidates)}.` };
  }
  return { success: false, error: `No encontre la prioridad "${query}" en IRIS.` };
}

async function resolveAssigneeReference(refs: { assigneeId?: string; assigneeQuery?: string; teamId: string }): Promise<ResolveResult<IrisTeamMemberDetail | null>> {
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

export async function createProject(data: {
  name: string;
  key?: string;
  description?: string;
  team_id?: string;
  team_name?: string;
}): Promise<{ success: boolean; data?: unknown; error?: string; warnings?: string[] }> {
  try {
    if (!irisSupa || !isIrisConfigured()) return { success: false, error: 'Database not configured' };
    const projectName = data.name?.trim();
    if (!projectName) return { success: false, error: 'El proyecto necesita un nombre valido.' };

    const session = await sofiaAuth.getSession();
    let userId = session?.user?.id;
    if (!userId) {
      const { data: authData } = await irisSupa.auth.getUser();
      userId = authData.user?.id;
    }
    if (!userId) return { success: false, error: 'Usuario no autenticado en el sistema.' };

    const warnings: string[] = [];
    const teamResult = await resolveTeamReference(
      { teamId: data.team_id, teamName: data.team_name },
      { allowSingleTeamDefault: true, missingMessage: 'Debes indicar el equipo donde se va a crear el proyecto.' },
    );
    if (!teamResult.success) return { success: false, error: teamResult.error };
    warnings.push(...teamResult.warnings);

    await ensureUserExistsInIris(userId);
    const existingProjects = await getProjects(teamResult.value.team_id);
    const requestedKey = normalizeProjectKey(data.key);
    const projectKey = generateUniqueProjectKey(projectName, existingProjects.map((project) => project.project_key), data.key);
    if (!requestedKey) warnings.push(`Se genero automaticamente la clave del proyecto: ${projectKey}.`);
    else if (projectKey !== requestedKey) warnings.push(`La clave ${requestedKey} ya estaba en uso y se genero ${projectKey}.`);

    const { data: projectRecord, error } = await irisSupa
      .from('pm_projects')
      .insert({
        project_name: projectName,
        project_key: projectKey,
        project_description: data.description?.trim() || '',
        team_id: teamResult.value.team_id,
        created_by_user_id: userId,
        project_status: 'planning',
        health_status: 'none',
        priority_level: 'medium',
        completion_percentage: 0,
        is_public: true,
        is_template: false,
      })
      .select('*')
      .single();

    if (error) return { success: false, error: error.message, warnings: warnings.length ? warnings : undefined };
    return { success: true, data: projectRecord, warnings: warnings.length ? warnings : undefined };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function createIrisIssue(data: {
  title: string;
  description?: string;
  team_id?: string;
  team_name?: string;
  project_id?: string;
  project_name?: string;
  priority_id?: string;
  priority_name?: string;
  status_id?: string;
  status_name?: string;
  assignee_id?: string;
  assignee_name?: string;
  assignee_query?: string;
}): Promise<{ success: boolean; data?: IrisIssue; error?: string; warnings?: string[] }> {
  try {
    if (!irisSupa || !isIrisConfigured()) return { success: false, error: 'Database not configured' };
    const title = data.title?.trim();
    if (!title) return { success: false, error: 'La tarea necesita un titulo valido.' };

    const session = await sofiaAuth.getSession();
    let userId = session?.user?.id;
    if (!userId) {
      const { data: authData } = await irisSupa.auth.getUser();
      userId = authData.user?.id;
    }
    if (!userId) return { success: false, error: 'Usuario no autenticado' };

    const warnings: string[] = [];
    let explicitTeam: IrisTeam | null = null;
    if (data.team_id?.trim() || data.team_name?.trim()) {
      const teamResult = await resolveTeamReference(
        { teamId: data.team_id, teamName: data.team_name },
        { allowSingleTeamDefault: false, missingMessage: 'No encontre el equipo indicado para crear la tarea.' },
      );
      if (!teamResult.success) return { success: false, error: teamResult.error };
      explicitTeam = teamResult.value;
      warnings.push(...teamResult.warnings);
    }

    const projectResult = await resolveProjectReference({
      projectId: data.project_id,
      projectName: data.project_name,
      scopedTeamId: explicitTeam?.team_id,
    });
    if (!projectResult.success) return { success: false, error: projectResult.error, warnings: warnings.length ? warnings : undefined };
    warnings.push(...projectResult.warnings);

    const teams = await getTeams();
    let effectiveTeam = explicitTeam;
    if (projectResult.value?.team_id) {
      const projectTeam = teams.find((team) => team.team_id === projectResult.value?.team_id) || null;
      if (!projectTeam) return { success: false, error: 'El proyecto seleccionado no tiene un equipo valido en IRIS.' };
      if (explicitTeam && explicitTeam.team_id !== projectTeam.team_id) {
        return { success: false, error: `El proyecto "${projectResult.value.project_name}" pertenece al equipo "${projectTeam.name}" y no al equipo "${explicitTeam.name}".` };
      }
      effectiveTeam = projectTeam;
    }
    if (!effectiveTeam) {
      const teamResult = await resolveTeamReference(
        { teamId: data.team_id, teamName: data.team_name },
        { allowSingleTeamDefault: true, missingMessage: 'Debes indicar el equipo donde se va a crear la tarea.' },
      );
      if (!teamResult.success) return { success: false, error: teamResult.error, warnings: warnings.length ? warnings : undefined };
      warnings.push(...teamResult.warnings);
      effectiveTeam = teamResult.value;
    }

    const statusResult = await resolveStatusReference({ statusId: data.status_id, statusName: data.status_name, teamId: effectiveTeam.team_id });
    if (!statusResult.success) return { success: false, error: statusResult.error, warnings: warnings.length ? warnings : undefined };
    const priorityResult = await resolvePriorityReference({ priorityId: data.priority_id, priorityName: data.priority_name });
    if (!priorityResult.success) return { success: false, error: priorityResult.error, warnings: warnings.length ? warnings : undefined };
    const assigneeResult = await resolveAssigneeReference({
      assigneeId: data.assignee_id,
      assigneeQuery: data.assignee_name || data.assignee_query,
      teamId: effectiveTeam.team_id,
    });
    if (!assigneeResult.success) return { success: false, error: assigneeResult.error, warnings: warnings.length ? warnings : undefined };

    await ensureUserExistsInIris(userId);
    if (assigneeResult.value?.user_id && assigneeResult.value.user_id !== userId) await ensureUserExistsInIris(assigneeResult.value.user_id);

    const insertBase: Record<string, any> = {
      title,
      description: data.description?.trim() || '',
      team_id: effectiveTeam.team_id,
      project_id: projectResult.value?.project_id || null,
      priority_id: priorityResult.value?.priority_id || null,
      status_id: statusResult.value.status_id,
      assignee_id: assigneeResult.value?.user_id || null,
      creator_id: userId,
    };

    let lastError: any = null;
    let collisionWarningAdded = false;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const issueNumber = await getNextIssueNumber(effectiveTeam.team_id);
      const response = await irisSupa
        .from('task_issues')
        .insert({ ...insertBase, issue_number: issueNumber })
        .select('*, status:task_statuses(*), priority:task_priorities(*)')
        .single();
      if (!response.error) {
        return { success: true, data: response.data as IrisIssue, warnings: warnings.length ? warnings : undefined };
      }
      lastError = response.error;
      const duplicateIssueNumber =
        response.error.code === '23505' &&
        `${response.error.message || ''} ${response.error.details || ''}`.toLowerCase().includes('issue_number');
      if (duplicateIssueNumber && attempt < 3) {
        if (!collisionWarningAdded) {
          warnings.push('Hubo una colision temporal al asignar el numero de issue y se reintento la creacion.');
          collisionWarningAdded = true;
        }
        continue;
      }
      return { success: false, error: response.error.message, warnings: warnings.length ? warnings : undefined };
    }

    return { success: false, error: lastError?.message || 'No se pudo crear la tarea en IRIS.', warnings: warnings.length ? warnings : undefined };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export const PROJECT_STATUS_COLORS: Record<string, string> = {
  active: '#22c55e',
  completed: '#3b82f6',
  on_hold: '#f59e0b',
  planning: '#8b5cf6',
  cancelled: '#ef4444',
  archived: '#6b7280',
};

export const ISSUE_STATUS_TYPE_COLORS: Record<string, string> = {
  done: '#22c55e',
  in_progress: '#3b82f6',
  in_review: '#8b5cf6',
  todo: '#f59e0b',
  backlog: '#6b7280',
  cancelled: '#ef4444',
};

export function needsIrisData(message: string): boolean {
  const lower = message.toLowerCase();
  return IRIS_KEYWORDS.some((kw) => lower.includes(kw));
}

export async function buildIrisContext(): Promise<string> {
  if (!irisSupa || !isIrisConfigured()) return '';
  try {
    const parts: string[] = ['=== DATOS DE IRIS (Project Hub) ==='];
    const teams = await getTeams();
    const teamById = new Map(teams.map((team) => [team.team_id, team]));
    if (teams.length) {
      parts.push('\n## Equipos:');
      for (const team of teams.slice(0, 5)) {
        parts.push(`- ${team.name} (${team.slug}) | Estado: ${team.status} | ID: ${team.team_id}`);
      }
    }

    const projects = await getProjects();
    const projectById = new Map(projects.map((project) => [project.project_id, project]));
    if (projects.length) {
      parts.push('\n## Proyectos:');
      for (const project of projects.slice(0, 10)) {
        const teamName = project.team_id ? teamById.get(project.team_id)?.name || project.team_id : 'Sin equipo';
        const description = project.project_description ? ` | Descripcion: ${project.project_description}` : '';
        parts.push(`- ${project.project_name} [${project.project_key}] | Equipo: ${teamName} | Estado: ${project.project_status} | Progreso: ${project.completion_percentage}% | Prioridad: ${project.priority_level} | ID: ${project.project_id}${description}`);
      }
    }

    let totalIssues = 0;
    for (const team of teams.slice(0, 3)) {
      if (totalIssues >= 30) break;
      const issues = await getIssues({ teamId: team.team_id, limit: Math.min(15, 30 - totalIssues) });
      if (!issues.length) continue;
      parts.push(`\n## Issues (equipo: ${team.name}):`);
      for (const issue of issues) {
        const projectName = issue.project_id ? projectById.get(issue.project_id)?.project_name || issue.project_id : 'Sin proyecto';
        parts.push(`- #${issue.issue_number} ${issue.title} | Proyecto: ${projectName} | Estado: ${issue.status?.name || 'Sin estado'} | Prioridad: ${issue.priority?.name || 'Sin prioridad'} | ID: ${issue.issue_id}`);
        totalIssues += 1;
      }
    }

    if (parts.length <= 1) return '';
    parts.push('\n=== FIN DATOS IRIS ===');
    return parts.join('\n');
  } catch {
    return '';
  }
}
