import { z } from 'zod';
import { captureDirectProjectContext, directData, directWrite, directProject, directProjectDependencies, type DirectProjectContext, type DirectProjectDependencies } from './direct-context';
import { directProjectCollection, directProjectRecord } from './direct-projects';
import { directAnalytics, directReadCollection, directTaskOptions, directTeamView } from './direct-views';
import { directEvidence, directLinkedDocuments, directMilestone, directRecord } from './direct-resources';
import { directTaskRecord } from './direct-tasks';
import { directProjectMember, directTeamMutation } from './direct-members';
import { projectHubFailure, ProjectHubError } from './session-contract';
import type { ProjectHubOperationAuthorization } from './session-context';
import type { ProjectHubEnvelope, ProjectHubRequestOptions, ProjectHubResult } from './types';

/** Conserva el contrato IPC; sus rutas son internas y nunca se envían a un servidor web. */
export class DirectProjectBackend {
  constructor(private readonly dependencies = directProjectDependencies) {}
  capture(auth?: ProjectHubOperationAuthorization) { return captureDirectProjectContext(this.dependencies, auth); }
  async status(auth?: ProjectHubOperationAuthorization) {
    let context: DirectProjectContext | undefined;
    try {
      context = await this.capture(auth);
      return { configured: true, enabled: true, browserCollectionsEnabled: process.env.BROWSER_COLLECTIONS !== 'false', authenticated: true, endpoint: '', connection: 'database', workspaces: [context.workspace] };
    } catch (error) {
      return { configured: !(error instanceof ProjectHubError && error.code === 'NOT_CONFIGURED'), enabled: true, browserCollectionsEnabled: true, authenticated: false, endpoint: '', connection: 'database', workspaces: [], authError: projectHubFailure(error) };
    } finally { context?.dispose(); }
  }
  async request<T>(route: string, options: ProjectHubRequestOptions, auth?: ProjectHubOperationAuthorization): Promise<ProjectHubResult<T>> {
    let context: DirectProjectContext | undefined;
    try {
      context = await this.capture(auth);
      const url = new URL(route, 'https://internal.invalid');
      const parts = url.pathname.split('/').filter(Boolean);
      if (parts[0] !== 'api' || parts[1] !== 'v1' || parts[2] !== 'workspaces' || parts[4] !== 'projects' || z.string().uuid().parse(parts[3]) !== context.workspace.id) throw new ProjectHubError('WORKSPACE_FORBIDDEN', 'La solicitud no pertenece a la organización activa.');
      const method = options.method ?? 'GET';
      let result;
      if (parts.length === 5) result = await directProjectCollection(context, method, options.body, url.searchParams);
      else {
        const projectId = z.string().uuid().parse(parts[5]);
        if (method !== 'GET') context.writeTarget = { projectId, access: parts.length === 6 || ['milestones', 'members', 'team', 'task-labels'].includes(parts[6]) || parts[6] === 'evidence' && !!parts[7] ? 'admin' : 'write' };
        if (parts.length === 6) result = await directProjectRecord(context, projectId, method, options.body);
        else result = await this.resource(context, projectId, parts.slice(6), method, directRecord(options.body), url.searchParams, options);
      }
      await context.check();
      return { success: true, ...result } as ProjectHubResult<T>;
    } catch (error) {
      const failure = error instanceof z.ZodError ? { success: false, code: 'INVALID_PAYLOAD', error: 'Revisa los datos de la operación de proyectos.' } : projectHubFailure(error);
      const uncertain = options.method && options.method !== 'GET' && (context?.effects || context?.writePending || ['UNAVAILABLE', 'DATABASE_UNAVAILABLE', 'INVALID_RESPONSE', 'SESSION_CHANGED'].includes(failure.code ?? ''));
      return { ...failure, ...(uncertain ? { uncertain: true, recoveryRequired: true } : {}) };
    } finally { context?.dispose(); }
  }
  private async resource(context: DirectProjectContext, projectId: string, parts: string[], method: string, body: ReturnType<typeof directRecord>, params: URLSearchParams, options: ProjectHubRequestOptions): Promise<ProjectHubEnvelope<unknown>> {
    const project = await directProject(context, context.workspace.id, projectId, method === 'GET' ? 'read' : 'write');
    const [kind, id, tail, nested] = parts;
    if (id && kind !== 'files') z.string().uuid().parse(id);
    if (nested) z.string().uuid().parse(nested);
    if (method === 'GET' && parts.length === 1) {
      if (kind === 'analytics') return directAnalytics(context, projectId);
      if (kind === 'team') return directTeamView(context, project);
      if (kind === 'task-options') return directTaskOptions(context, project);
      return directReadCollection(context, projectId, kind, params);
    }
    if (kind === 'documents') return directLinkedDocuments(context, project, undefined, id, method, body, params);
    if (kind === 'milestones') return directMilestone(context, project, id, method, body, params);
    if (kind === 'members') return directProjectMember(context, project, id, method, body);
    if (kind === 'evidence') return directEvidence(context, project, id, method, body);
    if (kind === 'team') return directTeamMutation(context, project, id, nested, method, body);
    if (kind === 'tasks') {
      if (tail === 'documents') return directLinkedDocuments(context, project, id, nested, method, body, params);
      return directTaskRecord(context, project, id, method, body, tail);
    }
    if (kind === 'task-labels' && method === 'POST') {
      if (!['owner', 'admin'].includes(String(project.role))) throw new ProjectHubError('PROJECT_FORBIDDEN', 'Sólo quien administra el proyecto puede crear etiquetas.');
      if (!project.team_id) throw new ProjectHubError('PROJECT_TEAM_REQUIRED', 'Asigna un equipo al proyecto antes de crear etiquetas.');
      const input = z.object({ name: z.string().trim().min(1).max(255), color: z.string().regex(/^#[a-f\d]{6}$/i) }).strict().parse(body);
      return { data: await directWrite(context.iris.from('task_labels').insert({ ...input, team_id: project.team_id, created_by: context.actorId }).select('*').single(), context) };
    }
    if (kind === 'files' && tail === 'download' && method === 'GET') {
      const evidenceId = z.string().uuid().parse(id);
      const evidence = await directData(context.iris.from('pm_project_evidence').select('*').eq('workspace_id', context.workspace.id).eq('project_id', projectId).eq('evidence_id', evidenceId).is('archived_at', null).maybeSingle(), context);
      const { projectDownloadDescription } = await import('./download-target');
      const file = projectDownloadDescription(evidence, { workspaceId: context.workspace.id, projectId, evidenceId });
      const signed = await context.iris.storage.from('project-files').createSignedUrl(file.storagePath, 300); await context.check();
      if (signed.error || !signed.data) throw new ProjectHubError('DOWNLOAD_DENIED', 'No se pudo autorizar la descarga del archivo histórico.');
      return { data: { signed_url: signed.data.signedUrl, expires_in: 300 } };
    }
    if (kind === 'browser-collections') {
      const { projectHubCollection } = await import('../../src/shared/project-hub');
      const collection = projectHubCollection.parse(body);
      return directEvidence(context, project, undefined, 'POST', { type: 'browser_collection', source_system: 'soflia-hub', title: collection.name, external_reference: collection.external_reference, version: collection.version, summary: collection.summary, items: collection.tabs });
    }
    if (kind === 'meeting-imports') {
      // RPC transaccional existente en la base; no se reimplementa con escrituras parciales.
      const { createHash } = await import('node:crypto');
      const { projectHubMeeting } = await import('../../src/shared/project-hub');
      const meeting = projectHubMeeting.parse(body);
      return { data: await directWrite(context.iris.rpc('project_hub_import_meeting', { p_workspace_id: context.workspace.id, p_project_id: projectId, p_actor_user_id: context.actorId, p_idempotency_key: options.idempotencyKey, p_request_hash: createHash('sha256').update(JSON.stringify(meeting)).digest('hex'), p_evidence: meeting.evidence, p_items: meeting.items ?? [], p_tasks: meeting.tasks ?? [] }), context) };
    }
    throw new ProjectHubError('DIRECT_OPERATION_UNAVAILABLE', 'Esta operación histórica no está disponible. Usa los archivos en la ubicación elegida para el proyecto.');
  }
  async findProjectWorkspace(projectId: string): Promise<string | null> {
    let context;
    try { context = await this.capture(); await directProject(context, context.workspace.id, projectId); return context.workspace.id; }
    catch { return null; } finally { context?.dispose(); }
  }
}
export type { DirectProjectDependencies };
