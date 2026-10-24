import type { ProjectHubInputs, ProjectHubRole } from '../shared/project-hub';
import type { ProjectDownloadInput, ProjectDownloadResult, ProjectUploadInput, ProjectUploadProgress, ProjectUploadResult } from '../shared/project-hub-files';

export interface ProjectHubResult<T = unknown> {
  success: boolean;
  data?: T;
  meta?: { correlation_id?: string; next_cursor?: string | null; has_more?: boolean };
  error?: string;
  code?: string;
  cancelled?: boolean;
  uncertain?: boolean;
  recoveryRequired?: boolean;
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
  role?: string;
  team_id?: string | null;
  target_date?: string | null;
  start_date?: string | null;
}

interface ProjectHubBridge {
  getStatus: () => Promise<ProjectHubResult<{ configured: boolean; endpoint?: string; enabled: boolean; browserCollectionsEnabled: boolean; authenticated: boolean; workspaces: Array<{ id: string; name: string; role: string }>; authError?: { code?: string; error?: string } | null }>>;
  retryAuthentication: () => Promise<ProjectHubResult<{ workspaces: Array<{ id: string; name: string; role: string }> }>>;
  listProjects: (input: ProjectHubInputs['listProjects']) => Promise<ProjectHubResult<ProjectHubProject[]>>;
  createProject: (input: ProjectHubInputs['createProject']) => Promise<ProjectHubResult<ProjectHubProject>>;
  getProject: (input: ProjectHubInputs['getProject']) => Promise<ProjectHubResult<ProjectHubProject>>;
  updateProject: (input: ProjectHubInputs['updateProject']) => Promise<ProjectHubResult<ProjectHubProject>>;
  listTasks: (input: ProjectHubInputs['listTasks']) => Promise<ProjectHubResult<unknown[]>>;
  createTask: (input: ProjectHubInputs['createTask']) => Promise<ProjectHubResult>;
  updateTask: (input: ProjectHubInputs['updateTask']) => Promise<ProjectHubResult>;
  listMembers: (input: ProjectHubInputs['listMembers']) => Promise<ProjectHubResult<unknown[]>>;
  addMember: (input: ProjectHubInputs['addMember']) => Promise<ProjectHubResult>;
  updateMember: (input: ProjectHubInputs['updateMember']) => Promise<ProjectHubResult>;
  removeMember: (input: ProjectHubInputs['removeMember']) => Promise<ProjectHubResult>;
  listEvidence: (input: ProjectHubInputs['listEvidence']) => Promise<ProjectHubResult<unknown[]>>;
  getEvidence: (input: ProjectHubInputs['getEvidence']) => Promise<ProjectHubResult<Record<string, unknown>>>;
  addEvidence: (input: ProjectHubInputs['addEvidence']) => Promise<ProjectHubResult>;
  getAnalytics: (input: ProjectHubInputs['getAnalytics']) => Promise<ProjectHubResult<Record<string, unknown>>>;
  createBrowserCollection: (input: ProjectHubInputs['createBrowserCollection']) => Promise<ProjectHubResult>;
  importMeeting: (input: ProjectHubInputs['importMeeting']) => Promise<ProjectHubResult>;
  uploadFiles: (input: ProjectUploadInput) => Promise<ProjectUploadResult>;
  cancelUpload: (input: Pick<ProjectUploadInput, 'operationId'>) => Promise<ProjectHubResult>;
  downloadFile: (input: ProjectDownloadInput) => Promise<ProjectDownloadResult>;
  cancelDownload: (input: Pick<ProjectDownloadInput, 'operationId'>) => Promise<ProjectHubResult>;
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
  createProject: (workspaceId: string, project: ProjectHubInputs['createProject']['project']) => bridge()?.createProject({ workspaceId, project }) ?? unavailable<ProjectHubProject>(),
  getProject: (workspaceId: string, projectId: string) => bridge()?.getProject({ workspaceId, projectId }) ?? unavailable<ProjectHubProject>(),
  updateProject: (workspaceId: string, projectId: string, updates: ProjectHubInputs['updateProject']['updates']) => bridge()?.updateProject({ workspaceId, projectId, updates }) ?? unavailable<ProjectHubProject>(),
  listTasks: (workspaceId: string, projectId: string) => bridge()?.listTasks({ workspaceId, projectId }) ?? unavailable<unknown[]>(),
  createTask: (workspaceId: string, projectId: string, task: ProjectHubInputs['createTask']['task']) => bridge()?.createTask({ workspaceId, projectId, task }) ?? unavailable(),
  updateTask: (workspaceId: string, projectId: string, taskId: string, updates: ProjectHubInputs['updateTask']['updates']) => bridge()?.updateTask({ workspaceId, projectId, taskId, updates }) ?? unavailable(),
  listMembers: (workspaceId: string, projectId: string) => bridge()?.listMembers({ workspaceId, projectId }) ?? unavailable<unknown[]>(),
  addMember: (workspaceId: string, projectId: string, userId: string, role: ProjectHubRole) => bridge()?.addMember({ workspaceId, projectId, userId, role }) ?? unavailable(),
  updateMember: (workspaceId: string, projectId: string, memberId: string, role: ProjectHubRole) => bridge()?.updateMember({ workspaceId, projectId, memberId, role }) ?? unavailable(),
  removeMember: (workspaceId: string, projectId: string, memberId: string) => bridge()?.removeMember({ workspaceId, projectId, memberId }) ?? unavailable(),
  listEvidence: (workspaceId: string, projectId: string) => bridge()?.listEvidence({ workspaceId, projectId }) ?? unavailable<unknown[]>(),
  getEvidence: (workspaceId: string, projectId: string, evidenceId: string) => bridge()?.getEvidence({ workspaceId, projectId, evidenceId }) ?? unavailable<Record<string, unknown>>(),
  addEvidence: (workspaceId: string, projectId: string, evidence: ProjectHubInputs['addEvidence']['evidence']) => bridge()?.addEvidence({ workspaceId, projectId, evidence }) ?? unavailable(),
  downloadFile: (workspaceId: string, projectId: string, evidenceId: string, operationId: string): Promise<ProjectDownloadResult> =>
    bridge()?.downloadFile({ workspaceId, projectId, evidenceId, operationId }) ?? unavailable<{ saved: boolean; bytes: number }>(),
  cancelDownload: (operationId: string) => bridge()?.cancelDownload({ operationId }) ?? unavailable(),
  analytics: (workspaceId: string, projectId: string) => bridge()?.getAnalytics({ workspaceId, projectId }) ?? unavailable<Record<string, unknown>>(),
  createBrowserCollection: (workspaceId: string, projectId: string, collection: ProjectHubInputs['createBrowserCollection']['collection']) => bridge()?.createBrowserCollection({ workspaceId, projectId, collection }) ?? unavailable(),
  importMeeting: (workspaceId: string, projectId: string, idempotencyKey: string, meeting: ProjectHubInputs['importMeeting']['meeting']) => bridge()?.importMeeting({ workspaceId, projectId, idempotencyKey, meeting }) ?? unavailable(),
  uploadFiles: (workspaceId: string, projectId: string, operationId: string): Promise<ProjectUploadResult> =>
    bridge()?.uploadFiles({ workspaceId, projectId, operationId }) ?? unavailable<ProjectUploadProgress>(),
  cancelUpload: (operationId: string) => bridge()?.cancelUpload({ operationId }) ?? unavailable(),
};
