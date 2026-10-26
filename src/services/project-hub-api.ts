import { waitForAuthStatePublication } from './auth-state';
import type { ProjectManagementInputs } from '../shared/project-management';
import type { ProjectCreationInputs, ProjectFolderSelection, ProjectLocation, ProjectOrganization, ProjectCloudAccount, ProjectCloudFolderListing, ProjectCloudSelection, ProjectLocationFiles } from '../shared/project-creation';
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
  resolveOrganization: (input: ProjectCreationInputs['resolveOrganization']) => Promise<ProjectHubResult<ProjectOrganization>>;
  selectFolder: (input: ProjectCreationInputs['selectFolder']) => Promise<ProjectHubResult<ProjectFolderSelection>>;
  cloudAccounts: (input: ProjectCreationInputs['cloudAccounts']) => Promise<ProjectHubResult<ProjectCloudAccount[]>>;
  authorizeCloud: (input: ProjectCreationInputs['authorizeCloud']) => Promise<ProjectHubResult>;
  cloudFolders: (input: ProjectCreationInputs['cloudFolders']) => Promise<ProjectHubResult<ProjectCloudFolderListing>>;
  createCloudFolder: (input: ProjectCreationInputs['createCloudFolder']) => Promise<ProjectHubResult<ProjectCloudSelection>>;
  locationFiles: (input: ProjectCreationInputs['locationFiles']) => Promise<ProjectHubResult<ProjectLocationFiles>>;
  uploadLocationFiles: (input: ProjectCreationInputs['uploadLocationFiles']) => Promise<ProjectUploadResult>;
  cancelLocationUpload: (input: ProjectCreationInputs['cancelLocationUpload']) => Promise<ProjectHubResult>;
  createConfigured: (input: ProjectCreationInputs['createConfigured']) => Promise<ProjectHubResult<ProjectHubProject>>;
  getLocation: (input: ProjectCreationInputs['getLocation']) => Promise<ProjectHubResult<ProjectLocation | null>>;
  getTaskDetail: (input: ProjectManagementInputs['getTaskDetail']) => Promise<ProjectHubResult>;
  addTaskComment: (input: ProjectManagementInputs['addTaskComment']) => Promise<ProjectHubResult>;
  listTaskDocuments: (input: ProjectManagementInputs['listTaskDocuments']) => Promise<ProjectHubResult>;
  createTaskDocument: (input: ProjectManagementInputs['createTaskDocument']) => Promise<ProjectHubResult>;
  updateTaskDocument: (input: ProjectManagementInputs['updateTaskDocument']) => Promise<ProjectHubResult>;
  removeTaskDocument: (input: ProjectManagementInputs['removeTaskDocument']) => Promise<ProjectHubResult>;
  createTaskLabel: (input: ProjectManagementInputs['createTaskLabel']) => Promise<ProjectHubResult>;
  getTaskOptions: (input: ProjectManagementInputs['getTaskOptions']) => Promise<ProjectHubResult>;
  archiveTask: (input: ProjectManagementInputs['archiveTask']) => Promise<ProjectHubResult>;
  listMilestones: (input: ProjectManagementInputs['listMilestones']) => Promise<ProjectHubResult>;
  createMilestone: (input: ProjectManagementInputs['createMilestone']) => Promise<ProjectHubResult>;
  updateMilestone: (input: ProjectManagementInputs['updateMilestone']) => Promise<ProjectHubResult>;
  cancelMilestone: (input: ProjectManagementInputs['cancelMilestone']) => Promise<ProjectHubResult>;
  getProjectTeam: (input: ProjectManagementInputs['getProjectTeam']) => Promise<ProjectHubResult>;
  assignProjectTeam: (input: ProjectManagementInputs['assignProjectTeam']) => Promise<ProjectHubResult>;
  createProjectTeam: (input: ProjectManagementInputs['createProjectTeam']) => Promise<ProjectHubResult>;
  updateProjectTeam: (input: ProjectManagementInputs['updateProjectTeam']) => Promise<ProjectHubResult>;
  addTeamMember: (input: ProjectManagementInputs['addTeamMember']) => Promise<ProjectHubResult>;
  updateTeamMember: (input: ProjectManagementInputs['updateTeamMember']) => Promise<ProjectHubResult>;
  removeTeamMember: (input: ProjectManagementInputs['removeTeamMember']) => Promise<ProjectHubResult>;
  listDocuments: (input: ProjectManagementInputs['listDocuments']) => Promise<ProjectHubResult>;
  createDocument: (input: ProjectManagementInputs['createDocument']) => Promise<ProjectHubResult>;
  updateDocument: (input: ProjectManagementInputs['updateDocument']) => Promise<ProjectHubResult>;
  removeDocument: (input: ProjectManagementInputs['removeDocument']) => Promise<ProjectHubResult>;
  updateEvidence: (input: ProjectManagementInputs['updateEvidence']) => Promise<ProjectHubResult>;
  archiveEvidence: (input: ProjectManagementInputs['archiveEvidence']) => Promise<ProjectHubResult>;
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
  resolveOrganization: (organizationId: string) => bridge()?.resolveOrganization?.({ organizationId }) ?? unavailable<ProjectOrganization>(),
  selectFolder: () => bridge()?.selectFolder?.({}) ?? unavailable<ProjectFolderSelection>(),
  cloudAccounts: () => bridge()?.cloudAccounts?.({}) ?? unavailable<ProjectCloudAccount[]>(),
  authorizeCloud: (input: ProjectCreationInputs['authorizeCloud']) => bridge()?.authorizeCloud?.(input) ?? unavailable(),
  cloudFolders: (input: ProjectCreationInputs['cloudFolders']) => bridge()?.cloudFolders?.(input) ?? unavailable<ProjectCloudFolderListing>(),
  createCloudFolder: (input: ProjectCreationInputs['createCloudFolder']) => bridge()?.createCloudFolder?.(input) ?? unavailable<ProjectCloudSelection>(),
  locationFiles: (input: ProjectCreationInputs['locationFiles']) => bridge()?.locationFiles?.(input) ?? unavailable<ProjectLocationFiles>(),
  uploadLocationFiles: (input: ProjectCreationInputs['uploadLocationFiles']) => bridge()?.uploadLocationFiles?.(input) ?? unavailable(),
  cancelLocationUpload: (operationId: string) => bridge()?.cancelLocationUpload?.({ operationId }) ?? unavailable(),
  createConfigured: (input: ProjectCreationInputs['createConfigured']) => bridge()?.createConfigured?.(input) ?? unavailable<ProjectHubProject>(),
  getLocation: (input: ProjectCreationInputs['getLocation']) => bridge()?.getLocation?.(input) ?? unavailable<ProjectLocation | null>(),
  getTaskDetail: (input: ProjectManagementInputs['getTaskDetail']) => bridge()?.getTaskDetail?.(input) ?? unavailable(),
  addTaskComment: (input: ProjectManagementInputs['addTaskComment']) => bridge()?.addTaskComment?.(input) ?? unavailable(),
  listTaskDocuments: (input: ProjectManagementInputs['listTaskDocuments']) => bridge()?.listTaskDocuments?.(input) ?? unavailable(),
  createTaskDocument: (input: ProjectManagementInputs['createTaskDocument']) => bridge()?.createTaskDocument?.(input) ?? unavailable(),
  updateTaskDocument: (input: ProjectManagementInputs['updateTaskDocument']) => bridge()?.updateTaskDocument?.(input) ?? unavailable(),
  removeTaskDocument: (input: ProjectManagementInputs['removeTaskDocument']) => bridge()?.removeTaskDocument?.(input) ?? unavailable(),
  createTaskLabel: (input: ProjectManagementInputs['createTaskLabel']) => bridge()?.createTaskLabel?.(input) ?? unavailable(),
  getTaskOptions: (input: ProjectManagementInputs['getTaskOptions']) => bridge()?.getTaskOptions?.(input) ?? unavailable(),
  archiveTask: (input: ProjectManagementInputs['archiveTask']) => bridge()?.archiveTask?.(input) ?? unavailable(),
  listMilestones: (input: ProjectManagementInputs['listMilestones']) => bridge()?.listMilestones?.(input) ?? unavailable(),
  createMilestone: (input: ProjectManagementInputs['createMilestone']) => bridge()?.createMilestone?.(input) ?? unavailable(),
  updateMilestone: (input: ProjectManagementInputs['updateMilestone']) => bridge()?.updateMilestone?.(input) ?? unavailable(),
  cancelMilestone: (input: ProjectManagementInputs['cancelMilestone']) => bridge()?.cancelMilestone?.(input) ?? unavailable(),
  getProjectTeam: (input: ProjectManagementInputs['getProjectTeam']) => bridge()?.getProjectTeam?.(input) ?? unavailable(),
  assignProjectTeam: (input: ProjectManagementInputs['assignProjectTeam']) => bridge()?.assignProjectTeam?.(input) ?? unavailable(),
  createProjectTeam: (input: ProjectManagementInputs['createProjectTeam']) => bridge()?.createProjectTeam?.(input) ?? unavailable(),
  updateProjectTeam: (input: ProjectManagementInputs['updateProjectTeam']) => bridge()?.updateProjectTeam?.(input) ?? unavailable(),
  addTeamMember: (input: ProjectManagementInputs['addTeamMember']) => bridge()?.addTeamMember?.(input) ?? unavailable(),
  updateTeamMember: (input: ProjectManagementInputs['updateTeamMember']) => bridge()?.updateTeamMember?.(input) ?? unavailable(),
  removeTeamMember: (input: ProjectManagementInputs['removeTeamMember']) => bridge()?.removeTeamMember?.(input) ?? unavailable(),
  listDocuments: (input: ProjectManagementInputs['listDocuments']) => bridge()?.listDocuments?.(input) ?? unavailable(),
  createDocument: (input: ProjectManagementInputs['createDocument']) => bridge()?.createDocument?.(input) ?? unavailable(),
  updateDocument: (input: ProjectManagementInputs['updateDocument']) => bridge()?.updateDocument?.(input) ?? unavailable(),
  removeDocument: (input: ProjectManagementInputs['removeDocument']) => bridge()?.removeDocument?.(input) ?? unavailable(),
  updateEvidence: (input: ProjectManagementInputs['updateEvidence']) => bridge()?.updateEvidence?.(input) ?? unavailable(),
  archiveEvidence: (input: ProjectManagementInputs['archiveEvidence']) => bridge()?.archiveEvidence?.(input) ?? unavailable(),
  status: async () => {
    if (!await waitForAuthStatePublication()) {
      return { success: false as const, code: 'SOFIA_SESSION_PENDING', error: 'Preparando la sesión de proyectos…' };
    }
    return bridge()?.getStatus() ?? unavailable();
  },
  retryAuthentication: () => bridge()?.retryAuthentication() ?? unavailable(),
  listProjects: (workspaceId: string, search?: string, cursor?: string) => bridge()?.listProjects({ workspaceId, search, cursor }) ?? unavailable<ProjectHubProject[]>(),
  createProject: (workspaceId: string, project: ProjectHubInputs['createProject']['project']) => bridge()?.createProject({ workspaceId, project }) ?? unavailable<ProjectHubProject>(),
  getProject: (workspaceId: string, projectId: string) => bridge()?.getProject({ workspaceId, projectId }) ?? unavailable<ProjectHubProject>(),
  updateProject: (workspaceId: string, projectId: string, updates: ProjectHubInputs['updateProject']['updates']) => bridge()?.updateProject({ workspaceId, projectId, updates }) ?? unavailable<ProjectHubProject>(),
  listTasks: (workspaceId: string, projectId: string, filters?: Omit<ProjectHubInputs['listTasks'], 'workspaceId' | 'projectId'>) => bridge()?.listTasks({ ...filters, workspaceId, projectId }) ?? unavailable<unknown[]>(),
  createTask: (workspaceId: string, projectId: string, task: ProjectHubInputs['createTask']['task']) => bridge()?.createTask({ workspaceId, projectId, task }) ?? unavailable(),
  updateTask: (workspaceId: string, projectId: string, taskId: string, updates: ProjectHubInputs['updateTask']['updates']) => bridge()?.updateTask({ workspaceId, projectId, taskId, updates }) ?? unavailable(),
  listMembers: (workspaceId: string, projectId: string, filters?: Omit<ProjectHubInputs['listMembers'], 'workspaceId' | 'projectId'>) => bridge()?.listMembers({ ...filters, workspaceId, projectId }) ?? unavailable<unknown[]>(),
  addMember: (workspaceId: string, projectId: string, userId: string, role: ProjectHubRole) => bridge()?.addMember({ workspaceId, projectId, userId, role }) ?? unavailable(),
  updateMember: (workspaceId: string, projectId: string, memberId: string, role: ProjectHubRole) => bridge()?.updateMember({ workspaceId, projectId, memberId, role }) ?? unavailable(),
  removeMember: (workspaceId: string, projectId: string, memberId: string) => bridge()?.removeMember({ workspaceId, projectId, memberId }) ?? unavailable(),
  listEvidence: (workspaceId: string, projectId: string, filters?: Omit<ProjectHubInputs['listEvidence'], 'workspaceId' | 'projectId'>) => bridge()?.listEvidence({ ...filters, workspaceId, projectId }) ?? unavailable<unknown[]>(),
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
