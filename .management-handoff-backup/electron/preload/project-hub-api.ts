import type { ProjectHubInputs } from '../../src/shared/project-hub';
import type { ProjectDownloadInput, ProjectUploadInput } from '../../src/shared/project-hub-files';
import type { PreloadBridge, SafeIpc } from './types';

export function exposeProjectHubApi(bridge: PreloadBridge, ipc: SafeIpc): void {
  const invoke = (channel: string, input?: unknown) => input === undefined ? ipc.safeInvoke(channel) : ipc.safeInvoke(channel, input);
  bridge.exposeInMainWorld('projectHubApi', {
    getStatus: () => invoke('project-hub:status'),
    retryAuthentication: () => invoke('project-hub:retry-auth'),
    listProjects: (input: ProjectHubInputs['listProjects']) => invoke('project-hub:list-projects', input),
    createProject: (input: ProjectHubInputs['createProject']) => invoke('project-hub:create-project', input),
    getProject: (input: ProjectHubInputs['getProject']) => invoke('project-hub:get-project', input),
    updateProject: (input: ProjectHubInputs['updateProject']) => invoke('project-hub:update-project', input),
    listTasks: (input: ProjectHubInputs['listTasks']) => invoke('project-hub:list-tasks', input),
    createTask: (input: ProjectHubInputs['createTask']) => invoke('project-hub:create-task', input),
    updateTask: (input: ProjectHubInputs['updateTask']) => invoke('project-hub:update-task', input),
    listMembers: (input: ProjectHubInputs['listMembers']) => invoke('project-hub:list-members', input),
    addMember: (input: ProjectHubInputs['addMember']) => invoke('project-hub:add-member', input),
    updateMember: (input: ProjectHubInputs['updateMember']) => invoke('project-hub:update-member', input),
    removeMember: (input: ProjectHubInputs['removeMember']) => invoke('project-hub:remove-member', input),
    listEvidence: (input: ProjectHubInputs['listEvidence']) => invoke('project-hub:list-evidence', input),
    getEvidence: (input: ProjectHubInputs['getEvidence']) => invoke('project-hub:get-evidence', input),
    addEvidence: (input: ProjectHubInputs['addEvidence']) => invoke('project-hub:add-evidence', input),
    getAnalytics: (input: ProjectHubInputs['getAnalytics']) => invoke('project-hub:get-analytics', input),
    createBrowserCollection: (input: ProjectHubInputs['createBrowserCollection']) => invoke('project-hub:create-browser-collection', input),
    importMeeting: (input: ProjectHubInputs['importMeeting']) => invoke('project-hub:import-meeting', input),
    uploadFiles: (input: ProjectUploadInput) => invoke('project-hub:upload-files', input),
    cancelUpload: (input: Pick<ProjectUploadInput, 'operationId'>) => invoke('project-hub:cancel-upload', input),
    downloadFile: (input: ProjectDownloadInput) => invoke('project-hub:download-file', input),
    cancelDownload: (input: Pick<ProjectDownloadInput, 'operationId'>) => invoke('project-hub:cancel-download', input),
  });
}
