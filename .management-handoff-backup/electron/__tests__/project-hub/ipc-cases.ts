export const IPC_ID = '12345678-1234-4123-8123-123456789012';
const target = { workspaceId: IPC_ID, projectId: IPC_ID };
export const projectHubIpcCases = [
  { channel: 'status', method: 'getStatus', mutation: false, input: undefined },
  { channel: 'retry-auth', method: 'retryAuthentication', mutation: false, input: undefined },
  { channel: 'list-projects', method: 'listProjects', mutation: false, input: { workspaceId: IPC_ID } },
  { channel: 'create-project', method: 'createProject', mutation: true, input: { workspaceId: IPC_ID, project: { name: 'Proyecto ficticio' } } },
  { channel: 'get-project', method: 'getProject', mutation: false, input: target },
  { channel: 'update-project', method: 'updateProject', mutation: true, input: { ...target, updates: { status: 'archived' } } },
  { channel: 'list-tasks', method: 'listTasks', mutation: false, input: target },
  { channel: 'create-task', method: 'createTask', mutation: true, input: { ...target, task: { title: 'Tarea ficticia' } } },
  { channel: 'update-task', method: 'updateTask', mutation: true, input: { ...target, taskId: IPC_ID, updates: { due_date: null } } },
  { channel: 'list-members', method: 'listMembers', mutation: false, input: target },
  { channel: 'add-member', method: 'addMember', mutation: true, input: { ...target, userId: IPC_ID, role: 'member' } },
  { channel: 'update-member', method: 'updateMember', mutation: true, input: { ...target, memberId: IPC_ID, role: 'viewer' } },
  { channel: 'remove-member', method: 'removeMember', mutation: true, input: { ...target, memberId: IPC_ID } },
  { channel: 'list-evidence', method: 'listEvidence', mutation: false, input: target },
  { channel: 'get-evidence', method: 'getEvidence', mutation: false, input: { ...target, evidenceId: IPC_ID } },
  { channel: 'add-evidence', method: 'addEvidence', mutation: true, input: { ...target, evidence: { type: 'link', source_system: 'web', title: 'Fuente ficticia', metadata: { url: 'https://fuente.example.test' }, items: [] } } },
  { channel: 'get-analytics', method: 'getAnalytics', mutation: false, input: target },
  { channel: 'create-browser-collection', method: 'createBrowserCollection', mutation: true, input: { ...target, collection: { name: 'Investigación ficticia', external_reference: IPC_ID, version: 1, tabs: [{ type: 'tab', position: 0, title: 'Pestaña ficticia', source_url: 'https://fuente.example.test', content: 'Extracto ficticio' }] } } },
  { channel: 'import-meeting', method: 'importMeeting', mutation: true, input: { ...target, idempotencyKey: 'reunion-ficticia-1', meeting: { approved: true, evidence: { external_reference: 'reunion-ficticia', title: 'Reunión ficticia', summary: 'Resumen ficticio', content_hash: 'a'.repeat(64) }, tasks: [{ mode: 'create', title: 'Acuerdo ficticio' }] } } },
] as const;
