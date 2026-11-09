import { z } from 'zod';
import { directData, directWrite, type DirectProjectContext, type ProjectRow } from './direct-context';
import { directPage } from './direct-projects';
import { ProjectHubError } from './session-contract';
import { linkedDocument, milestoneFields } from '../../src/shared/project-management';

const object = z.record(z.string(), z.unknown());
export function directRecord(value: unknown): ProjectRow { return object.parse(value ?? {}); }
export function directAdmin(project: ProjectRow) { if (!['owner', 'admin'].includes(String(project.role))) throw new ProjectHubError('PROJECT_FORBIDDEN', 'Necesitas administrar el proyecto para realizar este cambio.'); }
export async function directTask(context: DirectProjectContext, projectId: string, taskId: string) {
  const task = await directData(context.iris.from('task_issues').select('*').eq('project_id', projectId).eq('issue_id', taskId).is('archived_at', null).maybeSingle(), context);
  if (!task) throw new ProjectHubError('NOT_FOUND', 'No se encontró la tarea en este proyecto.');
  return task as ProjectRow;
}
export async function directLinkedDocuments(context: DirectProjectContext, project: ProjectRow, taskId: string | undefined, documentId: string | undefined, method: string, body: ProjectRow, params: URLSearchParams) {
  if (taskId) await directTask(context, String(project.project_id), taskId);
  const table = taskId ? 'task_issue_documents' : 'pm_project_documents'; const field = taskId ? 'issue_id' : 'project_id'; const id = taskId ?? project.project_id;
  if (method === 'GET') return directPage(context.iris.from(table).select('*').eq(field, id).order('created_at', { ascending: false }).order('id'), context, params, 'name');
  if (method === 'POST') {
    const document = linkedDocument.parse(body.document);
    return { data: await directWrite(context.iris.from(table).insert({ ...document, [field]: id, created_by: context.actorId }).select('*').single(), context) };
  }
  const existing = await directData(context.iris.from(table).select('id,updated_at').eq(field, id).eq('id', documentId).maybeSingle(), context);
  if (!existing) throw new ProjectHubError('NOT_FOUND', 'No se encontró la referencia del documento.');
  const expected = body.expectedUpdatedAt ?? params.get('expectedUpdatedAt');
  if (expected && expected !== existing.updated_at) throw new ProjectHubError('CONFLICT', 'El documento cambió. Actualiza antes de repetir.');
  if (method === 'DELETE') return { data: await directWrite(context.iris.from(table).delete().eq(field, id).eq('id', documentId).eq('updated_at', existing.updated_at).select('id').single(), context) };
  const updates = z.object({ name: z.string().trim().min(1).max(255), doc_type: linkedDocument.shape.doc_type.optional() }).strict().parse(body.updates);
  return { data: await directWrite(context.iris.from(table).update({ ...updates, updated_at: new Date().toISOString() }).eq(field, id).eq('id', documentId).eq('updated_at', existing.updated_at).select('*').single(), context) };
}
export async function directMilestone(context: DirectProjectContext, project: ProjectRow, milestoneId: string | undefined, method: string, body: ProjectRow, params: URLSearchParams) {
  directAdmin(project);
  if (method === 'POST') {
    const input = milestoneFields.parse(body.milestone);
    return { data: await directWrite(context.iris.from('pm_milestones').insert({ project_id: project.project_id, milestone_name: input.name, milestone_description: input.description ?? null, target_date: input.target_date, milestone_status: input.status ?? 'pending', sort_order: input.sort_order ?? 0 }).select('*').single(), context) };
  }
  const updates = method === 'DELETE' ? { status: 'cancelled' } : milestoneFields.partial().parse(body.updates);
  const names: Record<string, string> = { name: 'milestone_name', description: 'milestone_description', status: 'milestone_status' };
  const values = Object.fromEntries(Object.entries(updates).map(([key, value]) => [names[key] ?? key, value]));
  const existing = await directData(context.iris.from('pm_milestones').select('milestone_id,updated_at').eq('project_id', project.project_id).eq('milestone_id', milestoneId).maybeSingle(), context);
  if (!existing) throw new ProjectHubError('NOT_FOUND', 'No se encontró el hito en este proyecto.');
  const expected = body.expectedUpdatedAt ?? params.get('expectedUpdatedAt');
  if (expected && expected !== existing.updated_at) throw new ProjectHubError('CONFLICT', 'El hito cambió. Actualiza antes de repetir.');
  return { data: await directWrite(context.iris.from('pm_milestones').update({ ...values, updated_at: new Date().toISOString() }).eq('project_id', project.project_id).eq('milestone_id', milestoneId).eq('updated_at', existing.updated_at).select('*').single(), context) };
}
export async function directEvidence(context: DirectProjectContext, project: ProjectRow, evidenceId: string | undefined, method: string, body: ProjectRow) {
  const table = () => context.iris.from('pm_project_evidence');
  if (method === 'GET') {
    const evidence = await directData(table().select('*,pm_project_evidence_items(*)').eq('workspace_id', context.workspace.id).eq('project_id', project.project_id).eq('evidence_id', evidenceId).is('archived_at', null).maybeSingle(), context);
    if (!evidence) throw new ProjectHubError('NOT_FOUND', 'No se encontró la referencia del archivo.');
    return { data: evidence };
  }
  if (method === 'POST') {
    const { projectHubEvidenceCreate } = await import('../../src/shared/project-hub');
    const input = projectHubEvidenceCreate.parse(body);
    const evidence = await directWrite(table().insert({ workspace_id: context.workspace.id, project_id: project.project_id, evidence_type: input.type, source_system: input.source_system, external_reference: input.external_reference, version: input.version ?? 1, title: input.title, summary: input.summary, content_hash: input.content_hash, metadata: input.metadata ?? {}, created_by_user_id: context.actorId }).select('*').single(), context);
    const items = input.items?.length ? await directWrite(context.iris.from('pm_project_evidence_items').insert(input.items.map(({ type, ...item }) => ({ ...item, item_type: type, evidence_id: evidence.evidence_id }))).select('*'), context) : [];
    return { data: { ...evidence, pm_project_evidence_items: items } };
  }
  directAdmin(project);
  if (method === 'DELETE') return { data: await directWrite(table().update({ archived_at: new Date().toISOString() }).eq('workspace_id', context.workspace.id).eq('project_id', project.project_id).eq('evidence_id', evidenceId).is('archived_at', null).select('*').single(), context) };
  const updates = z.object({ title: z.string().min(1).max(500), summary: z.string().max(20000).nullable().optional(), expected_title: z.string(), expected_summary: z.string().nullable() }).strict().parse(body.updates);
  let query = table().update({ title: updates.title, summary: updates.summary }).eq('workspace_id', context.workspace.id).eq('project_id', project.project_id).eq('evidence_id', evidenceId).eq('title', updates.expected_title).is('archived_at', null);
  query = updates.expected_summary === null ? query.is('summary', null) : query.eq('summary', updates.expected_summary);
  return { data: await directWrite(query.select('*').single(), context) };
}
