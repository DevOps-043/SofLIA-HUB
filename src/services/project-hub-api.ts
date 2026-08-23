export interface ProjectHubResult<T = unknown> {
  success: boolean;
  data?: T;
  meta?: { correlation_id?: string; next_cursor?: string | null; has_more?: boolean };
  error?: string;
  code?: string;
}

export interface ProjectHubProject {
  project_id: string;
  workspace_id: string;
  project_key: string;
  project_name: string;
  project_description?: string | null;
  project_status: string;
  priority_level: string;
  health_status: string;
  completion_percentage: number;
  updated_at: string;
  membership?: { project_role: string };
}

interface ProjectHubBridge {
  getStatus: () => Promise<ProjectHubResult<{ configured: boolean; endpoint?: string; enabled: boolean; browserCollectionsEnabled: boolean; authenticated: boolean; workspaces: Array<{ id: string; name: string; role: string }>; authError?: { code?: string; error?: string } | null }>>;
  retryAuthentication: () => Promise<ProjectHubResult<{ workspaces: Array<{ id: string; name: string; role: string }> }>>;
  listProjects: (input: unknown) => Promise<ProjectHubResult<ProjectHubProject[]>>;
  createProject: (input: unknown) => Promise<ProjectHubResult<ProjectHubProject>>;
  getProject: (input: unknown) => Promise<ProjectHubResult<ProjectHubProject>>;
  updateProject: (input: unknown) => Promise<ProjectHubResult<ProjectHubProject>>;
  listTasks: (input: unknown) => Promise<ProjectHubResult<unknown[]>>;
  createTask: (input: unknown) => Promise<ProjectHubResult>;
  updateTask: (input: unknown) => Promise<ProjectHubResult>;
  listMembers: (input: unknown) => Promise<ProjectHubResult<unknown[]>>;
  addMember: (input: unknown) => Promise<ProjectHubResult>;
  updateMember: (input: unknown) => Promise<ProjectHubResult>;
  removeMember: (input: unknown) => Promise<ProjectHubResult>;
  listEvidence: (input: unknown) => Promise<ProjectHubResult<unknown[]>>;
  getEvidence: (input: unknown) => Promise<ProjectHubResult<Record<string, unknown>>>;
  addEvidence: (input: unknown) => Promise<ProjectHubResult>;
  getAnalytics: (input: unknown) => Promise<ProjectHubResult<Record<string, unknown>>>;
  createBrowserCollection: (input: unknown) => Promise<ProjectHubResult>;
  importMeeting: (input: unknown) => Promise<ProjectHubResult>;
  createUploadIntent: (input: unknown) => Promise<ProjectHubResult<Array<{ evidence_id: string; signed_url: string; token: string }>>>;
  completeUpload: (input: unknown) => Promise<ProjectHubResult>;
  getDownload: (input: unknown) => Promise<ProjectHubResult<{ signed_url: string }>>;
}

function bridge(): ProjectHubBridge | null {
  if (typeof window === 'undefined') return null;
  return (window as Window & { projectHubApi?: ProjectHubBridge }).projectHubApi || null;
}

async function unavailable<T>(): Promise<ProjectHubResult<T>> {
  return { success: false, code: 'DESKTOP_ONLY', error: 'Project Hub solo está disponible en la aplicación de escritorio.' };
}

export const projectHubApi = {
  status: () => bridge()?.getStatus() ?? unavailable(),
  retryAuthentication: () => bridge()?.retryAuthentication() ?? unavailable(),
  listProjects: (workspaceId: string, search?: string, cursor?: string) => bridge()?.listProjects({ workspaceId, search, cursor }) ?? unavailable<ProjectHubProject[]>(),
  createProject: (workspaceId: string, project: Record<string, unknown>) => bridge()?.createProject({ workspaceId, project }) ?? unavailable<ProjectHubProject>(),
  getProject: (workspaceId: string, projectId: string) => bridge()?.getProject({ workspaceId, projectId }) ?? unavailable<ProjectHubProject>(),
  updateProject: (workspaceId: string, projectId: string, updates: Record<string, unknown>) => bridge()?.updateProject({ workspaceId, projectId, updates }) ?? unavailable<ProjectHubProject>(),
  listTasks: (workspaceId: string, projectId: string) => bridge()?.listTasks({ workspaceId, projectId }) ?? unavailable<unknown[]>(),
  createTask: (workspaceId: string, projectId: string, task: Record<string, unknown>) => bridge()?.createTask({ workspaceId, projectId, task }) ?? unavailable(),
  listMembers: (workspaceId: string, projectId: string) => bridge()?.listMembers({ workspaceId, projectId }) ?? unavailable<unknown[]>(),
  addMember: (workspaceId: string, projectId: string, userId: string, role: string) => bridge()?.addMember({ workspaceId, projectId, userId, role }) ?? unavailable(),
  updateMember: (workspaceId: string, projectId: string, memberId: string, role: string) => bridge()?.updateMember({ workspaceId, projectId, memberId, role }) ?? unavailable(),
  removeMember: (workspaceId: string, projectId: string, memberId: string) => bridge()?.removeMember({ workspaceId, projectId, memberId }) ?? unavailable(),
  listEvidence: (workspaceId: string, projectId: string) => bridge()?.listEvidence({ workspaceId, projectId }) ?? unavailable<unknown[]>(),
  getEvidence: (workspaceId: string, projectId: string, evidenceId: string) => bridge()?.getEvidence({ workspaceId, projectId, evidenceId }) ?? unavailable<Record<string, unknown>>(),
  addEvidence: (workspaceId: string, projectId: string, evidence: Record<string, unknown>) => bridge()?.addEvidence({ workspaceId, projectId, evidence }) ?? unavailable(),
  getDownload: (workspaceId: string, projectId: string, evidenceId: string) => bridge()?.getDownload({ workspaceId, projectId, evidenceId }) ?? unavailable<{ signed_url: string }>(),
  analytics: (workspaceId: string, projectId: string) => bridge()?.getAnalytics({ workspaceId, projectId }) ?? unavailable<Record<string, unknown>>(),
  createBrowserCollection: (workspaceId: string, projectId: string, collection: Record<string, unknown>) => bridge()?.createBrowserCollection({ workspaceId, projectId, collection }) ?? unavailable(),
  importMeeting: (workspaceId: string, projectId: string, idempotencyKey: string, meeting: Record<string, unknown>) => bridge()?.importMeeting({ workspaceId, projectId, idempotencyKey, meeting }) ?? unavailable(),
  uploadFiles: async (workspaceId: string, projectId: string, files: File[]): Promise<ProjectHubResult> => {
    const api = bridge();
    if (!api) return unavailable();
    const selected = files.slice(0, 10);
    const declarations = await Promise.all(selected.map(async (file) => ({
      name: file.name, mime_type: file.type, size: file.size,
      sha256: toHex(await crypto.subtle.digest('SHA-256', await file.arrayBuffer())),
    })));
    const intents = await api.createUploadIntent({ workspaceId, projectId, files: declarations });
    if (!intents.success || !intents.data) return intents;
    for (let index = 0; index < intents.data.length; index += 1) {
      const intent = intents.data[index];
      const upload = await fetch(intent.signed_url, { method: 'PUT', headers: { authorization: `Bearer ${intent.token}`, 'content-type': selected[index].type }, body: selected[index] });
      if (!upload.ok) return { success: false, code: 'UPLOAD_FAILED', error: `No se pudo subir ${selected[index].name}.` };
      const completed = await api.completeUpload({ workspaceId, projectId, evidenceId: intent.evidence_id });
      if (!completed.success) return completed;
    }
    return { success: true, data: { uploaded: intents.data.length } };
  },
};

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((value) => value.toString(16).padStart(2, '0')).join('');
}
