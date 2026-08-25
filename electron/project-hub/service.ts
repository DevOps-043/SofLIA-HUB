import { clearProjectHubSession, readProjectHubSession, saveProjectHubSession } from './session-store';
import type { ProjectHubEnvelope, ProjectHubProject, ProjectHubRequestOptions, ProjectHubResult, ProjectHubSession } from './types';

const REQUEST_TIMEOUT_MS = 15_000;
const IDEMPOTENT_RETRIES = 2;
const LOCAL_PROJECT_HUB_URL = 'http://127.0.0.1:3000';
const PUBLIC_PROJECT_HUB_URL = 'https://sofliahub.netlify.app';

class ProjectHubHttpError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

export class ProjectHubApiService {
  private readonly baseUrl: string;
  private session: ProjectHubSession | null = null;
  private refreshFlight: Promise<boolean> | null = null;
  private sofiaAccessToken: string | null = null;
  private lastAuthFailure: Pick<ProjectHubResult, 'code' | 'error'> | null = null;

  constructor(baseUrl = resolveProjectHubBaseUrl()) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  async getStatus() {
    if (!this.session?.accessToken) await this.restore();
    return {
      configured: Boolean(this.baseUrl),
      endpoint: this.baseUrl,
      enabled: process.env.PROJECT_HUB_UNIFIED_UI !== 'false',
      browserCollectionsEnabled: process.env.BROWSER_COLLECTIONS !== 'false',
      authenticated: Boolean(this.session?.accessToken),
      workspaces: this.session?.workspaces || [],
      authError: this.lastAuthFailure,
    };
  }

  async exchangeSofiaToken(sofiaAccessToken: string): Promise<ProjectHubResult<{ workspaces: ProjectHubSession['workspaces'] }>> {
    // Se conserva solo en memoria para permitir que el boton Reintentar repita
    // el canje. Nunca se persiste ni se expone de vuelta al renderer.
    this.sofiaAccessToken = sofiaAccessToken;
    if (!this.baseUrl) {
      const result = {
        success: false,
        code: 'NOT_CONFIGURED',
        error: 'Project Hub no está configurado en esta versión de Pulse Hub.',
      };
      this.lastAuthFailure = { code: result.code, error: result.error };
      return result;
    }
    try {
      const response = await this.fetchEnvelope<{
        access_token: string; refresh_token: string; expires_in: number; workspaces: ProjectHubSession['workspaces'];
      }>('/api/v1/auth/sofia/exchange', { method: 'POST', body: { sofia_access_token: sofiaAccessToken }, retry: false }, false);
      this.session = {
        accessToken: response.data.access_token, refreshToken: response.data.refresh_token,
        expiresAt: Date.now() + response.data.expires_in * 1000, workspaces: response.data.workspaces,
      };
      saveProjectHubSession(this.session);
      this.lastAuthFailure = null;
      return { success: true, data: { workspaces: this.session.workspaces } };
    } catch (error) {
      const result = failure(error);
      if (result.code === 'UNAVAILABLE') {
        result.error = `No se puede conectar con Project Hub en ${safeOrigin(this.baseUrl)}.`;
      }
      this.lastAuthFailure = { code: result.code, error: result.error };
      return result;
    }
  }

  async retryAuthentication(): Promise<ProjectHubResult<{ workspaces: ProjectHubSession['workspaces'] }>> {
    if (!this.sofiaAccessToken) {
      const result = { success: false, code: 'SOFIA_SESSION_PENDING', error: 'La sesión SOFIA todavía se está restaurando.' };
      this.lastAuthFailure = { code: result.code, error: result.error };
      return result;
    }
    return this.exchangeSofiaToken(this.sofiaAccessToken);
  }

  async restore(): Promise<boolean> {
    if (this.session?.accessToken) return true;
    const stored = readProjectHubSession();
    if (!stored) return false;
    this.session = { accessToken: '', refreshToken: stored.refreshToken, expiresAt: 0, workspaces: stored.workspaces };
    return this.refresh();
  }

  async logout(): Promise<void> {
    const accessToken = this.session?.accessToken;
    try { if (accessToken) await this.fetchEnvelope('/api/v1/auth/logout', { method: 'POST', retry: false }); } catch { /* cierre local prevalece */ }
    this.session = null;
    this.sofiaAccessToken = null;
    this.lastAuthFailure = null;
    clearProjectHubSession();
  }

  async listProjects(input: { workspaceId: string; search?: string; cursor?: string }): Promise<ProjectHubResult<ProjectHubProject[]>> {
    const query = new URLSearchParams();
    if (input.search) query.set('search', input.search);
    if (input.cursor) query.set('cursor', input.cursor);
    return this.call(`/api/v1/workspaces/${input.workspaceId}/projects${query.size ? `?${query}` : ''}`);
  }

  createProject(input: { workspaceId: string; project: Record<string, unknown> }) {
    return this.call<ProjectHubProject>(`/api/v1/workspaces/${input.workspaceId}/projects`, { method: 'POST', body: input.project, retry: false });
  }

  getProject(input: { workspaceId: string; projectId: string }) {
    return this.call<ProjectHubProject>(this.projectPath(input));
  }

  updateProject(input: { workspaceId: string; projectId: string; updates: Record<string, unknown> }) {
    return this.call<ProjectHubProject>(this.projectPath(input), { method: 'PATCH', body: input.updates, retry: false });
  }

  listTasks(input: { workspaceId: string; projectId: string }) { return this.call(`${this.projectPath(input)}/tasks`); }
  createTask(input: { workspaceId: string; projectId: string; task: Record<string, unknown> }) {
    return this.call(`${this.projectPath(input)}/tasks`, { method: 'POST', body: input.task, retry: false });
  }
  updateTask(input: { workspaceId: string; projectId: string; taskId: string; updates: Record<string, unknown> }) {
    return this.call(`${this.projectPath(input)}/tasks/${input.taskId}`, { method: 'PATCH', body: input.updates, retry: false });
  }
  listMembers(input: { workspaceId: string; projectId: string }) { return this.call(`${this.projectPath(input)}/members`); }
  addMember(input: { workspaceId: string; projectId: string; userId: string; role: string }) {
    return this.call(`${this.projectPath(input)}/members`, { method: 'POST', body: { user_id: input.userId, role: input.role }, retry: false });
  }
  updateMember(input: { workspaceId: string; projectId: string; memberId: string; role: string }) {
    return this.call(`${this.projectPath(input)}/members/${input.memberId}`, { method: 'PATCH', body: { role: input.role }, retry: false });
  }
  removeMember(input: { workspaceId: string; projectId: string; memberId: string }) {
    return this.call(`${this.projectPath(input)}/members/${input.memberId}`, { method: 'DELETE', retry: false });
  }
  listEvidence(input: { workspaceId: string; projectId: string }) { return this.call(`${this.projectPath(input)}/evidence`); }
  getEvidence(input: { workspaceId: string; projectId: string; evidenceId: string }) {
    return this.call(`${this.projectPath(input)}/evidence/${input.evidenceId}`);
  }
  addEvidence(input: { workspaceId: string; projectId: string; evidence: Record<string, unknown> }) {
    return this.call(`${this.projectPath(input)}/evidence`, { method: 'POST', body: input.evidence, retry: false });
  }
  getAnalytics(input: { workspaceId: string; projectId: string }) { return this.call(`${this.projectPath(input)}/analytics`); }
  createBrowserCollection(input: { workspaceId: string; projectId: string; collection: Record<string, unknown> }) {
    if (process.env.BROWSER_COLLECTIONS === 'false') return Promise.resolve({ success: false, code: 'FEATURE_DISABLED', error: 'Las colecciones del navegador no están habilitadas.' });
    return this.call(`${this.projectPath(input)}/browser-collections`, { method: 'POST', body: input.collection, retry: false });
  }
  importMeeting(input: { workspaceId: string; projectId: string; idempotencyKey: string; meeting: Record<string, unknown> }) {
    return this.call(`${this.projectPath(input)}/meeting-imports`, { method: 'POST', body: input.meeting, idempotencyKey: input.idempotencyKey, retry: false });
  }
  createUploadIntent(input: { workspaceId: string; projectId: string; files: Record<string, unknown>[] }) {
    return this.call(`${this.projectPath(input)}/files/intents`, { method: 'POST', body: { files: input.files }, retry: false });
  }
  completeUpload(input: { workspaceId: string; projectId: string; evidenceId: string }) {
    return this.call(`${this.projectPath(input)}/files/complete`, { method: 'POST', body: { evidence_id: input.evidenceId }, retry: false });
  }
  getDownload(input: { workspaceId: string; projectId: string; evidenceId: string }) {
    return this.call(`${this.projectPath(input)}/files/${input.evidenceId}/download`);
  }

  async findProjectWorkspace(projectId: string): Promise<string | null> {
    if (!this.session?.accessToken && !(await this.restore())) return null;
    for (const workspace of this.session?.workspaces || []) {
      const result = await this.getProject({ workspaceId: workspace.id, projectId });
      if (result.success) return workspace.id;
    }
    return null;
  }

  private projectPath(input: { workspaceId: string; projectId: string }) {
    return `/api/v1/workspaces/${input.workspaceId}/projects/${input.projectId}`;
  }

  private async call<T = unknown>(path: string, options: ProjectHubRequestOptions = {}): Promise<ProjectHubResult<T>> {
    try {
      if (!this.session?.accessToken && !(await this.restore())) return { success: false, code: 'NOT_AUTHENTICATED', error: 'Project Hub requiere volver a iniciar sesión.' };
      const response = await this.fetchEnvelope<T>(path, options);
      return { success: true, data: response.data, meta: response.meta };
    } catch (error) { return failure(error); }
  }

  private async fetchEnvelope<T>(path: string, options: ProjectHubRequestOptions, allowRefresh = true): Promise<ProjectHubEnvelope<T>> {
    if (!this.baseUrl) {
      throw new ProjectHubHttpError(503, 'NOT_CONFIGURED', 'Project Hub no está configurado en esta versión de Pulse Hub.');
    }
    const method = options.method || 'GET';
    const retries = options.retry !== false && ['GET'].includes(method) ? IDEMPOTENT_RETRIES : 0;
    for (let attempt = 0; ; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        const headers: Record<string, string> = { accept: 'application/json', 'x-correlation-id': crypto.randomUUID() };
        if (options.body !== undefined) headers['content-type'] = 'application/json';
        if (this.session?.accessToken) headers.authorization = `Bearer ${this.session.accessToken}`;
        if (options.idempotencyKey) headers['idempotency-key'] = options.idempotencyKey;
        const response = await fetch(`${this.baseUrl}${path}`, {
          method, headers, body: options.body === undefined ? undefined : JSON.stringify(options.body), signal: controller.signal,
        });
        const payload = await response.json().catch(() => null) as ProjectHubEnvelope<T> | null;
        if (response.status === 401 && allowRefresh && await this.refresh()) return this.fetchEnvelope(path, { ...options, retry: false }, false);
        if (!response.ok || !payload) {
          throw new ProjectHubHttpError(
            response.status,
            payload?.error?.code || `HTTP_${response.status}`,
            payload?.error?.message || `Project Hub respondió con HTTP ${response.status}.`,
          );
        }
        return payload;
      } catch (error) {
        if (attempt >= retries || error instanceof ProjectHubHttpError) throw error;
      } finally { clearTimeout(timer); }
    }
  }

  private async refresh(): Promise<boolean> {
    if (this.refreshFlight) return this.refreshFlight;
    this.refreshFlight = (async () => {
      const refreshToken = this.session?.refreshToken || readProjectHubSession()?.refreshToken;
      if (!refreshToken) return false;
      try {
        const response = await this.fetchEnvelope<{ access_token: string; refresh_token: string; expires_in: number }>(
          '/api/v1/auth/refresh', { method: 'POST', body: { refresh_token: refreshToken }, retry: false }, false,
        );
        const workspaces = this.session?.workspaces || readProjectHubSession()?.workspaces || [];
        this.session = { accessToken: response.data.access_token, refreshToken: response.data.refresh_token,
          expiresAt: Date.now() + response.data.expires_in * 1000, workspaces };
        saveProjectHubSession(this.session);
        return true;
      } catch (error) {
        if (error instanceof ProjectHubHttpError && error.status === 401) {
          this.session = null;
          clearProjectHubSession();
        }
        return false;
      }
    })().finally(() => { this.refreshFlight = null; });
    return this.refreshFlight;
  }
}

export function resolveProjectHubBaseUrl(): string {
  const runtimeUrl = process.env.PROJECT_HUB_API_URL?.trim();
  if (runtimeUrl) return runtimeUrl;

  // Vite sustituye esta expresión literal durante el build del proceso main.
  // Es una URL pública, nunca una credencial.
  const bundledUrl = process.env.VITE_PROJECT_HUB_API_URL?.trim();
  if (bundledUrl) return bundledUrl;

  // El servidor local es exclusivamente una comodidad de `npm run dev`.
  // Los instaladores usan el dominio oficial aunque el pipeline antiguo no
  // haya incorporado todavía la variable de build.
  return process.env.VITE_DEV_SERVER_URL ? LOCAL_PROJECT_HUB_URL : PUBLIC_PROJECT_HUB_URL;
}

function failure(error: unknown): ProjectHubResult<never> {
  if (error instanceof ProjectHubHttpError) return { success: false, code: error.code, error: error.message };
  if (error instanceof Error && error.name === 'AbortError') return { success: false, code: 'TIMEOUT', error: 'Project Hub tardó demasiado en responder.' };
  return { success: false, code: 'UNAVAILABLE', error: 'Project Hub no está disponible.' };
}

function safeOrigin(value: string): string {
  try {
    return new URL(value).origin;
  } catch {
    return 'el servidor configurado';
  }
}

let singleton: ProjectHubApiService | null = null;
export function getProjectHubApiService(): ProjectHubApiService {
  singleton ||= new ProjectHubApiService();
  return singleton;
}
