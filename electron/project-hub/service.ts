import { managementRequest, projectListQuery } from './management-request';
import type { ProjectManagementInputs } from '../../src/shared/project-management';
import type { ProjectHubInputs } from '../../src/shared/project-hub';
import { ProjectHubAuthentication, type ProjectHubCredentialStorage } from './authentication';
import { ProjectHubTransport } from './transport';
import { ProjectHubError, projectHubFailure } from './session-contract';
import type { ProjectHubOperationAuthorization } from './session-context';
import { uploadProjectFiles, type ProjectHubNativeUpload, type ProjectHubUploadAuthorization } from './upload';
import type { ProjectDownloadResult, ProjectUploadResult } from '../../src/shared/project-hub-files';
import { downloadProjectFile, type ProjectHubDownloadAuthorization, type ProjectHubDownloadTarget } from './download';
import type { ProjectHubProject, ProjectHubRequestOptions, ProjectHubResult, ProjectHubSession } from './types';
import { DirectProjectBackend } from './direct-backend';

const PUBLIC_PROJECT_HUB_URL = 'https://sofliahub.netlify.app';

export class ProjectHubApiService {
  private readonly transport: ProjectHubTransport;
  private readonly authentication: ProjectHubAuthentication;
  constructor(baseUrl = resolveProjectHubBaseUrl(), storage?: ProjectHubCredentialStorage, private readonly direct?: DirectProjectBackend) {
    this.transport = new ProjectHubTransport(baseUrl);
    this.authentication = new ProjectHubAuthentication(this.transport, storage);
  }
  getTaskOptions(input: ProjectManagementInputs['getTaskOptions'], authorization?: ProjectHubOperationAuthorization) { const request = managementRequest('getTaskOptions', input); return this.call(request.path, request.options, authorization); }
  archiveTask(input: ProjectManagementInputs['archiveTask'], authorization?: ProjectHubOperationAuthorization) { const request = managementRequest('archiveTask', input); return this.call(request.path, request.options, authorization); }
  listMilestones(input: ProjectManagementInputs['listMilestones'], authorization?: ProjectHubOperationAuthorization) { const request = managementRequest('listMilestones', input); return this.call(request.path, request.options, authorization); }
  createMilestone(input: ProjectManagementInputs['createMilestone'], authorization?: ProjectHubOperationAuthorization) { const request = managementRequest('createMilestone', input); return this.call(request.path, request.options, authorization); }
  updateMilestone(input: ProjectManagementInputs['updateMilestone'], authorization?: ProjectHubOperationAuthorization) { const request = managementRequest('updateMilestone', input); return this.call(request.path, request.options, authorization); }
  cancelMilestone(input: ProjectManagementInputs['cancelMilestone'], authorization?: ProjectHubOperationAuthorization) { const request = managementRequest('cancelMilestone', input); return this.call(request.path, request.options, authorization); }
  getProjectTeam(input: ProjectManagementInputs['getProjectTeam'], authorization?: ProjectHubOperationAuthorization) { const request = managementRequest('getProjectTeam', input); return this.call(request.path, request.options, authorization); }
  assignProjectTeam(input: ProjectManagementInputs['assignProjectTeam'], authorization?: ProjectHubOperationAuthorization) { const request = managementRequest('assignProjectTeam', input); return this.call(request.path, request.options, authorization); }
  createProjectTeam(input: ProjectManagementInputs['createProjectTeam'], authorization?: ProjectHubOperationAuthorization) { const request = managementRequest('createProjectTeam', input); return this.call(request.path, request.options, authorization); }
  updateProjectTeam(input: ProjectManagementInputs['updateProjectTeam'], authorization?: ProjectHubOperationAuthorization) { const request = managementRequest('updateProjectTeam', input); return this.call(request.path, request.options, authorization); }
  addTeamMember(input: ProjectManagementInputs['addTeamMember'], authorization?: ProjectHubOperationAuthorization) { const request = managementRequest('addTeamMember', input); return this.call(request.path, request.options, authorization); }
  updateTeamMember(input: ProjectManagementInputs['updateTeamMember'], authorization?: ProjectHubOperationAuthorization) { const request = managementRequest('updateTeamMember', input); return this.call(request.path, request.options, authorization); }
  removeTeamMember(input: ProjectManagementInputs['removeTeamMember'], authorization?: ProjectHubOperationAuthorization) { const request = managementRequest('removeTeamMember', input); return this.call(request.path, request.options, authorization); }
  listDocuments(input: ProjectManagementInputs['listDocuments'], authorization?: ProjectHubOperationAuthorization) { const request = managementRequest('listDocuments', input); return this.call(request.path, request.options, authorization); }
  createDocument(input: ProjectManagementInputs['createDocument'], authorization?: ProjectHubOperationAuthorization) { const request = managementRequest('createDocument', input); return this.call(request.path, request.options, authorization); }
  updateDocument(input: ProjectManagementInputs['updateDocument'], authorization?: ProjectHubOperationAuthorization) { const request = managementRequest('updateDocument', input); return this.call(request.path, request.options, authorization); }
  removeDocument(input: ProjectManagementInputs['removeDocument'], authorization?: ProjectHubOperationAuthorization) { const request = managementRequest('removeDocument', input); return this.call(request.path, request.options, authorization); }
  updateEvidence(input: ProjectManagementInputs['updateEvidence'], authorization?: ProjectHubOperationAuthorization) { const request = managementRequest('updateEvidence', input); return this.call(request.path, request.options, authorization); }
  archiveEvidence(input: ProjectManagementInputs['archiveEvidence'], authorization?: ProjectHubOperationAuthorization) { const request = managementRequest('archiveEvidence', input); return this.call(request.path, request.options, authorization); }
  getTaskDetail(input: ProjectManagementInputs['getTaskDetail'], authorization?: ProjectHubOperationAuthorization) { const request = managementRequest('getTaskDetail', input); return this.call(request.path, request.options, authorization); }
  addTaskComment(input: ProjectManagementInputs['addTaskComment'], authorization?: ProjectHubOperationAuthorization) { const request = managementRequest('addTaskComment', input); return this.call(request.path, request.options, authorization); }
  listTaskDocuments(input: ProjectManagementInputs['listTaskDocuments'], authorization?: ProjectHubOperationAuthorization) { const request = managementRequest('listTaskDocuments', input); return this.call(request.path, request.options, authorization); }
  createTaskDocument(input: ProjectManagementInputs['createTaskDocument'], authorization?: ProjectHubOperationAuthorization) { const request = managementRequest('createTaskDocument', input); return this.call(request.path, request.options, authorization); }
  updateTaskDocument(input: ProjectManagementInputs['updateTaskDocument'], authorization?: ProjectHubOperationAuthorization) { const request = managementRequest('updateTaskDocument', input); return this.call(request.path, request.options, authorization); }
  removeTaskDocument(input: ProjectManagementInputs['removeTaskDocument'], authorization?: ProjectHubOperationAuthorization) { const request = managementRequest('removeTaskDocument', input); return this.call(request.path, request.options, authorization); }
  createTaskLabel(input: ProjectManagementInputs['createTaskLabel'], authorization?: ProjectHubOperationAuthorization) { const request = managementRequest('createTaskLabel', input); return this.call(request.path, request.options, authorization); }
  async getStatus(authorization?: ProjectHubOperationAuthorization) {
    if (this.direct) return this.direct.status(authorization);
    return { configured: Boolean(this.transport.baseUrl), endpoint: this.transport.baseUrl,
      enabled: process.env.PROJECT_HUB_UNIFIED_UI !== 'false', browserCollectionsEnabled: process.env.BROWSER_COLLECTIONS !== 'false',
      ...await this.authentication.status(authorization) };
  }
  async exchangeSofiaToken(sofiaAccessToken: string): Promise<ProjectHubResult<{ workspaces: ProjectHubSession['workspaces'] }>> {
    if (this.direct) { const status = await this.direct.status(); return { success: status.authenticated, data: { workspaces: status.workspaces }, ...(!status.authenticated ? status.authError : {}) }; }
    return this.authentication.exchange(sofiaAccessToken);
  }
  async retryAuthentication(authorization?: ProjectHubOperationAuthorization): Promise<ProjectHubResult<{ workspaces: ProjectHubSession['workspaces'] }>> { if (this.direct) { const status = await this.direct.status(authorization); return { success: status.authenticated, data: { workspaces: status.workspaces }, ...(!status.authenticated ? status.authError : {}) }; } return this.authentication.retry(authorization); }
  async restore(): Promise<boolean> { return this.direct ? false : this.authentication.restore(); }
  async logout(): Promise<void> { if (!this.direct) await this.authentication.logout(); }

  async listProjects(input: { workspaceId: string; search?: string; cursor?: string }, authorization?: ProjectHubOperationAuthorization): Promise<ProjectHubResult<ProjectHubProject[]>> {
    const query = new URLSearchParams();
    if (input.search) query.set('search', input.search);
    if (input.cursor) query.set('cursor', input.cursor);
    return this.call(`/api/v1/workspaces/${input.workspaceId}/projects${query.size ? `?${query}` : ''}`, {}, authorization);
  }

  createProject(input: { workspaceId: string; project: Record<string, unknown> }, authorization?: ProjectHubOperationAuthorization) {
    return this.call<ProjectHubProject>(`/api/v1/workspaces/${input.workspaceId}/projects`, { method: 'POST', body: input.project, retry: false }, authorization);
  }

  getProject(input: { workspaceId: string; projectId: string }, authorization?: ProjectHubOperationAuthorization) {
    return this.call<ProjectHubProject>(this.projectPath(input), {}, authorization);
  }

  updateProject(input: { workspaceId: string; projectId: string; updates: Record<string, unknown> }, authorization?: ProjectHubOperationAuthorization) {
    return this.call<ProjectHubProject>(this.projectPath(input), { method: 'PATCH', body: input.updates, retry: false }, authorization);
  }

  listTasks(input: ProjectHubInputs['listTasks'], authorization?: ProjectHubOperationAuthorization) { return this.call(`${this.projectPath(input)}/tasks${projectListQuery(input)}`, {}, authorization); }
  createTask(input: { workspaceId: string; projectId: string; task: Record<string, unknown> }, authorization?: ProjectHubOperationAuthorization) {
    return this.call(`${this.projectPath(input)}/tasks`, { method: 'POST', body: input.task, retry: false }, authorization);
  }
  updateTask(input: { workspaceId: string; projectId: string; taskId: string; updates: Record<string, unknown> }, authorization?: ProjectHubOperationAuthorization) {
    return this.call(`${this.projectPath(input)}/tasks/${input.taskId}`, { method: 'PATCH', body: input.updates, retry: false }, authorization);
  }
  listMembers(input: ProjectHubInputs['listMembers'], authorization?: ProjectHubOperationAuthorization) { return this.call(`${this.projectPath(input)}/members${projectListQuery(input)}`, {}, authorization); }
  addMember(input: { workspaceId: string; projectId: string; userId: string; role: string }, authorization?: ProjectHubOperationAuthorization) {
    return this.call(`${this.projectPath(input)}/members`, { method: 'POST', body: { user_id: input.userId, role: input.role }, retry: false }, authorization);
  }
  updateMember(input: { workspaceId: string; projectId: string; memberId: string; role: string }, authorization?: ProjectHubOperationAuthorization) {
    return this.call(`${this.projectPath(input)}/members/${input.memberId}`, { method: 'PATCH', body: { role: input.role }, retry: false }, authorization);
  }
  removeMember(input: { workspaceId: string; projectId: string; memberId: string }, authorization?: ProjectHubOperationAuthorization) {
    return this.call(`${this.projectPath(input)}/members/${input.memberId}`, { method: 'DELETE', retry: false }, authorization);
  }
  listEvidence(input: ProjectHubInputs['listEvidence'], authorization?: ProjectHubOperationAuthorization) { return this.call(`${this.projectPath(input)}/evidence${projectListQuery(input)}`, {}, authorization); }
  getEvidence(input: { workspaceId: string; projectId: string; evidenceId: string }, authorization?: ProjectHubOperationAuthorization) {
    return this.call(`${this.projectPath(input)}/evidence/${input.evidenceId}`, {}, authorization);
  }
  addEvidence(input: { workspaceId: string; projectId: string; evidence: Record<string, unknown> }, authorization?: ProjectHubOperationAuthorization) {
    return this.call(`${this.projectPath(input)}/evidence`, { method: 'POST', body: input.evidence, retry: false }, authorization);
  }
  getAnalytics(input: { workspaceId: string; projectId: string }, authorization?: ProjectHubOperationAuthorization) { return this.call(`${this.projectPath(input)}/analytics`, {}, authorization); }
  createBrowserCollection(input: { workspaceId: string; projectId: string; collection: Record<string, unknown> }, authorization?: ProjectHubOperationAuthorization) {
    if (process.env.BROWSER_COLLECTIONS === 'false') return Promise.resolve({ success: false, code: 'FEATURE_DISABLED', error: 'Las colecciones del navegador no están habilitadas.' });
    return this.call(`${this.projectPath(input)}/browser-collections`, { method: 'POST', body: input.collection, retry: false }, authorization);
  }
  importMeeting(input: { workspaceId: string; projectId: string; idempotencyKey: string; meeting: Record<string, unknown> }, authorization?: ProjectHubOperationAuthorization) {
    return this.call(`${this.projectPath(input)}/meeting-imports`, { method: 'POST', body: input.meeting, idempotencyKey: input.idempotencyKey, retry: false }, authorization);
  }
  createUploadIntent(input: { workspaceId: string; projectId: string; files: Record<string, unknown>[] }, authorization?: ProjectHubOperationAuthorization) {
    return this.call(`${this.projectPath(input)}/files/intents`, { method: 'POST', body: { files: input.files }, retry: false }, authorization);
  }
  completeUpload(input: { workspaceId: string; projectId: string; evidenceId: string }, authorization?: ProjectHubOperationAuthorization) {
    return this.call(`${this.projectPath(input)}/files/complete`, { method: 'POST', body: { evidence_id: input.evidenceId }, retry: false }, authorization);
  }
  getDownload(input: { workspaceId: string; projectId: string; evidenceId: string }, authorization?: ProjectHubOperationAuthorization) {
    return this.call(`${this.projectPath(input)}/files/${input.evidenceId}/download`, {}, authorization);
  }
  async uploadFiles(input: ProjectHubNativeUpload, authorization: ProjectHubUploadAuthorization): Promise<ProjectUploadResult> {
    if (this.direct) return { success: false, code: 'LEGACY_UPLOAD_DISABLED', error: 'Añade los archivos en la ubicación elegida para el proyecto: equipo, Google Drive o OneDrive.' };
    let lease: Awaited<ReturnType<ProjectHubAuthentication['capture']>> | undefined;
    try {
      lease = await this.authentication.capture(authorization);
      // URL pública sustituida literalmente por Vite; no cargar clientes/.env.
      return await uploadProjectFiles(input, this, authorization, lease, process.env.VITE_IRIS_SUPABASE_URL ?? '');
    } catch { return { success: false, code: 'UPLOAD_DENIED', error: 'No se pudo autorizar la subida de archivos.' }; }
    finally { lease?.dispose(); }
  }
  async downloadFile(input: ProjectHubDownloadTarget, authorization: ProjectHubDownloadAuthorization): Promise<ProjectDownloadResult> {
    if (this.direct) {
      let context;
      try { context = await this.direct.capture(authorization); return await downloadProjectFile(input, this, authorization, { ...context, assert: () => context!.assert() }, process.env.VITE_IRIS_SUPABASE_URL ?? ''); }
      catch { return { success: false, code: 'DOWNLOAD_DENIED', error: 'No se pudo autorizar la descarga del archivo histórico.' }; }
      finally { context?.dispose(); }
    }
    let lease: Awaited<ReturnType<ProjectHubAuthentication['capture']>> | undefined;
    try {
      lease = await this.authentication.capture(authorization);
      return await downloadProjectFile(input, this, authorization, lease, process.env.VITE_IRIS_SUPABASE_URL ?? '');
    } catch { return { success: false, code: 'DOWNLOAD_DENIED', error: 'No se pudo autorizar la descarga.' }; }
    finally { lease?.dispose(); }
  }

  async findProjectWorkspace(projectId: string): Promise<string | null> {
    if (this.direct) return this.direct.findProjectWorkspace(projectId);
    let lease: Awaited<ReturnType<ProjectHubAuthentication['capture']>> | undefined;
    try {
      lease = await this.authentication.capture(); await this.authentication.access(lease);
      for (const workspace of this.authentication.workspaces(lease)) {
        lease.assert(); const result = await this.getProject({ workspaceId: workspace.id, projectId }); lease.assert();
        if (result.success) return workspace.id;
      }
      return null;
    } catch { return null; }
    finally { lease?.dispose(); }
  }
  private projectPath(input: { workspaceId: string; projectId: string }) { return `/api/v1/workspaces/${input.workspaceId}/projects/${input.projectId}`; }
  private async call<T = unknown>(path: string, options: ProjectHubRequestOptions = {}, authorization?: ProjectHubOperationAuthorization): Promise<ProjectHubResult<T>> {
    if (this.direct) return this.direct.request<T>(path, options, authorization);
    let lease: Awaited<ReturnType<ProjectHubAuthentication['capture']>> | undefined;
    try {
      lease = await this.authentication.capture(authorization);
      const accessToken = await this.authentication.access(lease);
      try {
        const response = await this.transport.request<T>(path, options, { accessToken, signal: lease.signal, assert: lease.assert });
        lease.assert(); return { success: true, data: response.data, meta: response.meta };
      } catch (error) {
        lease.assert();
        if (!(error instanceof ProjectHubError) || error.status !== 401) throw error;
        this.authentication.rejectAccess(accessToken);
        if ((options.method ?? 'GET') !== 'GET' || !await this.authentication.renew(lease, accessToken)) throw error;
        const renewed = await this.authentication.access(lease); lease.assert();
        const response = await this.transport.request<T>(path, { ...options, retry: false }, { accessToken: renewed, signal: lease.signal, assert: lease.assert });
        lease.assert(); return { success: true, data: response.data, meta: response.meta };
      }
    } catch (error) { return projectHubFailure(error); }
    finally { lease?.dispose(); }
  }
}

export function resolveProjectHubBaseUrl(): string {
  const runtimeUrl = process.env.PROJECT_HUB_API_URL?.trim();
  if (runtimeUrl) return runtimeUrl;

  // Vite sustituye esta expresión literal durante el build del proceso main.
  // Es una URL pública, nunca una credencial.
  const bundledUrl = process.env.VITE_PROJECT_HUB_API_URL?.trim();
  if (bundledUrl) return bundledUrl;

  // La URL oficial es segura como valor por defecto porque no contiene
  // credenciales. Localhost sólo se usa mediante PROJECT_HUB_API_URL explícita.
  return PUBLIC_PROJECT_HUB_URL;
}

let singleton: ProjectHubApiService | null = null;
export function getProjectHubApiService(): ProjectHubApiService {
  singleton ||= new ProjectHubApiService('', undefined, new DirectProjectBackend());
  return singleton;
}
