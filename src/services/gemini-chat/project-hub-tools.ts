import {
  createIrisIssue,
  createProject,
  deleteProject,
  getPriorities,
  getProjects,
  getStatuses,
  getTeamMembersDetailed,
  getTeams,
} from '../iris-data';

export async function executeProjectHubTool(toolName: string, toolArgs: Record<string, any>): Promise<string> {
  if (toolName === 'delete_iris_project') return JSON.stringify(await deleteProject(toolArgs.project_id));
  if (toolName === 'get_iris_teams') return JSON.stringify({ teams: await getTeams() });
  if (toolName === 'get_iris_projects') return JSON.stringify({ projects: await getProjects(toolArgs.team_id || toolArgs.team_name) });
  if (toolName === 'get_iris_team_members') return getTeamMembers(toolArgs);
  if (toolName === 'create_iris_project') return createProjectResult(toolArgs);
  if (toolName === 'create_iris_issue') return createIssueResult(toolArgs);
  if (toolName === 'get_iris_statuses') return getStatusesResult(toolArgs);
  if (toolName === 'get_iris_priorities') return JSON.stringify({ priorities: await getPriorities() });
  if (toolName === 'get_current_user_id') {
    const session = await (await import('../sofia-auth')).sofiaAuth.getSession();
    return JSON.stringify({ user_id: session?.user?.id });
  }
  return JSON.stringify({ success: false, error: 'Hub tool not implemented' });
}

async function getTeamMembers(args: Record<string, any>): Promise<string> {
  const teamRef = args.team_id || args.team_name;
  if (!teamRef) return JSON.stringify({ success: false, error: 'Debes indicar team_id o team_name.' });
  return JSON.stringify({ members: await getTeamMembersDetailed(teamRef) });
}

async function createProjectResult(args: Record<string, any>): Promise<string> {
  return JSON.stringify(await createProject({
    name: args.project_name,
    key: args.project_key,
    description: args.project_description || '',
    team_id: args.team_id || undefined,
    team_name: args.team_name || undefined,
  }));
}

async function createIssueResult(args: Record<string, any>): Promise<string> {
  return JSON.stringify(await createIrisIssue({
    title: args.title,
    description: args.description || '',
    team_id: args.team_id,
    team_name: args.team_name,
    project_id: args.project_id,
    project_name: args.project_name,
    status_id: args.status_id,
    status_name: args.status_name,
    priority_id: args.priority_id,
    priority_name: args.priority_name,
    assignee_id: args.assignee_id,
    assignee_name: args.assignee_name,
  }));
}

async function getStatusesResult(args: Record<string, any>): Promise<string> {
  const teamRef = args.team_id || args.team_name;
  return JSON.stringify({ statuses: teamRef ? await getStatuses(teamRef) : [] });
}
