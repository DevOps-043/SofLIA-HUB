import type { PreloadBridge, SafeIpc } from './types';

export function exposeProjectHubApi(bridge: PreloadBridge, ipc: SafeIpc): void {
  const invoke = (channel: string, input?: unknown) => input === undefined ? ipc.safeInvoke(channel) : ipc.safeInvoke(channel, input);
  bridge.exposeInMainWorld('projectHubApi', {
    getStatus: () => invoke('project-hub:status'),
    retryAuthentication: () => invoke('project-hub:retry-auth'),
    listProjects: (input: unknown) => invoke('project-hub:list-projects', input),
    createProject: (input: unknown) => invoke('project-hub:create-project', input),
    getProject: (input: unknown) => invoke('project-hub:get-project', input),
    updateProject: (input: unknown) => invoke('project-hub:update-project', input),
    listTasks: (input: unknown) => invoke('project-hub:list-tasks', input),
    createTask: (input: unknown) => invoke('project-hub:create-task', input),
    updateTask: (input: unknown) => invoke('project-hub:update-task', input),
    listMembers: (input: unknown) => invoke('project-hub:list-members', input),
    addMember: (input: unknown) => invoke('project-hub:add-member', input),
    updateMember: (input: unknown) => invoke('project-hub:update-member', input),
    removeMember: (input: unknown) => invoke('project-hub:remove-member', input),
    listEvidence: (input: unknown) => invoke('project-hub:list-evidence', input),
    getEvidence: (input: unknown) => invoke('project-hub:get-evidence', input),
    addEvidence: (input: unknown) => invoke('project-hub:add-evidence', input),
    getAnalytics: (input: unknown) => invoke('project-hub:get-analytics', input),
    createBrowserCollection: (input: unknown) => invoke('project-hub:create-browser-collection', input),
    importMeeting: (input: unknown) => invoke('project-hub:import-meeting', input),
    createUploadIntent: (input: unknown) => invoke('project-hub:create-upload-intent', input),
    completeUpload: (input: unknown) => invoke('project-hub:complete-upload', input),
    getDownload: (input: unknown) => invoke('project-hub:get-download', input),
  });
}
