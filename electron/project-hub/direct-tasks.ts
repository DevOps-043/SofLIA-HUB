import { z } from 'zod';
import { projectHubTaskCreate, projectHubTaskUpdate } from '../../src/shared/project-hub';
import { directData, directWrite, type DirectProjectContext, type ProjectRow } from './direct-context';
import { directTask } from './direct-resources';
import { ProjectHubError } from './session-contract';
import { resolveTaskStage } from './task-status';
import { safeWebUrl } from '../../src/services/project-web-url';

export async function directTaskRecord(context: DirectProjectContext, project: ProjectRow, taskId: string | undefined, method: string, body: ProjectRow, tail?: string) {
  const projectId = String(project.project_id);
  const existing = taskId ? await directTask(context, projectId, taskId) : null;
  if (method === 'GET') {
    const comments = await directData(context.iris.from('task_issue_comments').select('*,author:account_users!task_issue_comments_author_id_fkey(user_id,display_name,avatar_url)').eq('issue_id', taskId).is('deleted_at', null).order('created_at').limit(101), context);
    const history = await directData(context.iris.from('task_issue_history').select('*').eq('issue_id', taskId).order('created_at', { ascending: false }).limit(101), context);
    const labels = await directData(context.iris.from('task_issue_labels').select('task_labels(*)').eq('issue_id', taskId).limit(100), context);
    return { data: { task: existing, comments: (comments ?? []).slice(0, 100), history: (history ?? []).slice(0, 100), labels: labels ?? [], comments_partial: (comments?.length ?? 0) > 100, history_partial: (history?.length ?? 0) > 100 } };
  }
  if (tail === 'comments') {
    const content = z.string().trim().min(1).max(20000).parse(body.content);
    return { data: await directWrite(context.iris.from('task_issue_comments').insert({ issue_id: taskId, body: content, author_id: context.actorId }).select('*').single(), context) };
  }
  if (tail === 'archive') {
    if (!existing || body.expectedUpdatedAt && body.expectedUpdatedAt !== existing.updated_at) throw new ProjectHubError('CONFLICT', 'La tarea cambió. Actualiza antes de archivarla.');
    const child = await directData(context.iris.from('task_issues').select('issue_id').eq('project_id', projectId).eq('parent_issue_id', taskId).is('archived_at', null).limit(1), context);
    if (child?.length) throw new ProjectHubError('TASK_HAS_CHILDREN', 'Archiva primero las subtareas.');
    return { data: await directWrite(context.iris.from('task_issues').update({ archived_at: new Date().toISOString() }).eq('project_id', projectId).eq('issue_id', taskId).eq('updated_at', existing.updated_at).select('*').single(), context) };
  }
  const input = taskId ? projectHubTaskUpdate.parse(body) : projectHubTaskCreate.parse(body);
  if (!project.team_id) throw new ProjectHubError('PROJECT_TEAM_REQUIRED', 'Asigna un equipo desde la configuración del proyecto para organizar sus tareas.');
  if ('expected_updated_at' in input && input.expected_updated_at && input.expected_updated_at !== existing?.updated_at) throw new ProjectHubError('CONFLICT', 'La tarea cambió. Actualiza antes de repetir.');
  if (input.status_id && input.status_stage) throw new ProjectHubError('INVALID_REFERENCE', 'Selecciona un único estado.');
  const startedAt = input.started_at === undefined ? existing?.started_at : input.started_at;
  const dueDate = input.due_date === undefined ? existing?.due_date : input.due_date;
  if (startedAt && dueDate && new Date(String(startedAt)).toISOString().slice(0, 10) > String(dueDate)) throw new ProjectHubError('INVALID_REFERENCE', 'La fecha de inicio debe ser anterior o igual a la fecha límite.');
  if (input.priority_id) {
    const priority = await directData(context.iris.from('task_priorities').select('priority_id').eq('priority_id', input.priority_id).maybeSingle(), context);
    if (!priority) throw new ProjectHubError('INVALID_REFERENCE', 'La prioridad ya no está disponible.');
  }
  if (input.assignee_id) {
    const member = await directData(context.iris.from('workspace_members').select('user_id').eq('workspace_id', context.workspace.id).eq('user_id', input.assignee_id).eq('is_active', true).maybeSingle(), context);
    const projectMember = await directData(context.iris.from('pm_project_members').select('user_id').eq('project_id', projectId).eq('user_id', input.assignee_id).eq('membership_status', 'active').maybeSingle(), context);
    if (!member || !projectMember && project.created_by_user_id !== input.assignee_id) throw new ProjectHubError('INVALID_REFERENCE', 'La persona asignada no pertenece al proyecto.');
  }
  if (input.cycle_id) {
    const cycle = await directData(context.iris.from('task_cycles').select('cycle_id').eq('team_id', project.team_id).eq('cycle_id', input.cycle_id).maybeSingle(), context);
    if (!cycle) throw new ProjectHubError('INVALID_REFERENCE', 'El ciclo no pertenece al equipo.');
  }
  if (input.parent_issue_id) {
    const seen = new Set(taskId ? [taskId] : []); let next: string | null = input.parent_issue_id;
    while (next) {
      if (seen.has(next) || seen.size >= 50) throw new ProjectHubError('INVALID_REFERENCE', 'La jerarquía de tareas no es válida.');
      seen.add(next); const parent = await directTask(context, projectId, next);
      if (parent.team_id !== project.team_id) throw new ProjectHubError('INVALID_REFERENCE', 'La subtarea debe pertenecer al mismo equipo.');
      next = typeof parent.parent_issue_id === 'string' ? parent.parent_issue_id : null;
    }
  }
  if (input.label_ids?.length) {
    const labels = await directData(context.iris.from('task_labels').select('label_id').eq('team_id', project.team_id).in('label_id', input.label_ids), context);
    if (new Set(labels?.map(row => row.label_id)).size !== new Set(input.label_ids).size) throw new ProjectHubError('INVALID_REFERENCE', 'Una etiqueta no pertenece al equipo.');
  }
  if ('evidence_item_id' in input && input.evidence_item_id && !input.evidence_id) throw new ProjectHubError('INVALID_REFERENCE', 'El elemento necesita su evidencia de origen.');
  if ('evidence_id' in input && input.evidence_id) {
    const evidence = await directData(context.iris.from('pm_project_evidence').select('evidence_id').eq('project_id', projectId).eq('workspace_id', context.workspace.id).eq('evidence_id', input.evidence_id).is('archived_at', null).maybeSingle(), context);
    if (!evidence) throw new ProjectHubError('INVALID_REFERENCE', 'La evidencia no pertenece al proyecto.');
    if (input.evidence_item_id) {
      const item = await directData(context.iris.from('pm_project_evidence_items').select('item_id').eq('evidence_id', input.evidence_id).eq('item_id', input.evidence_item_id).maybeSingle(), context);
      if (!item) throw new ProjectHubError('INVALID_REFERENCE', 'El elemento no pertenece a la evidencia.');
    }
  }
  const statusId = input.status_stage ? await resolveTaskStage(context, project, input.status_stage) : input.status_id ?? existing?.status_id;
  let statuses = context.iris.from('task_statuses').select('status_id,status_type').eq('team_id', project.team_id);
  statuses = statusId ? statuses.eq('status_id', statusId) : statuses.eq('is_closed', false).order('is_default', { ascending: false }).order('position');
  const status = await directData(statuses.limit(1).maybeSingle(), context);
  if (!status) throw new ProjectHubError('STATUS_REQUIRED', 'El equipo necesita un estado de tarea disponible.');
  const changes: ProjectRow = Object.fromEntries(Object.entries(input).filter(([key]) => !['label_ids', 'expected_updated_at', 'evidence_id', 'evidence_item_id', 'status_stage'].includes(key)));
  if (input.external_links) changes.external_links = input.external_links.map(link => ({ ...link, url: safeWebUrl(link.url)! }));
  changes.status_id = status.status_id;
  if (status.status_type === 'done') changes.completed_at = existing?.completed_at ?? new Date().toISOString();
  else changes.completed_at = null;
  let task;
  if (existing) task = await directWrite(context.iris.from('task_issues').update({ ...changes, updated_at: new Date().toISOString() }).eq('project_id', projectId).eq('issue_id', taskId).eq('updated_at', existing.updated_at).select('*').single(), context);
  else {
    const last = await directData(context.iris.from('task_issues').select('issue_number').eq('team_id', project.team_id).order('issue_number', { ascending: false }).limit(1).maybeSingle(), context);
    task = await directWrite(context.iris.from('task_issues').insert({ ...changes, project_id: projectId, team_id: project.team_id, creator_id: context.actorId, issue_number: (last?.issue_number ?? 0) + 1 }).select('*').single(), context);
  }
  if (input.label_ids) {
    await directWrite(context.iris.from('task_issue_labels').delete().eq('issue_id', task.issue_id), context);
    if (input.label_ids.length) await directWrite(context.iris.from('task_issue_labels').insert([...new Set(input.label_ids)].map(label_id => ({ issue_id: task.issue_id, label_id }))), context);
  }
  if ('evidence_id' in input && input.evidence_id) await directWrite(context.iris.from('task_issue_evidence').insert({ issue_id: task.issue_id, evidence_id: input.evidence_id, evidence_item_id: input.evidence_item_id, relation_type: 'supports', created_by_user_id: context.actorId }), context);
  return { data: task };
}
