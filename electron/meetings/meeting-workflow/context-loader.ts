import { getTeamMembersDetailed, getTeams, type IrisTeamMemberDetail } from '../../iris-data-main';
import { getProjectHubApiService } from '../../project-hub';

export async function getMeetingWorkflowContext(): Promise<{ teams: any[]; projects: any[]; teamMembers: IrisTeamMemberDetail[] }> {
  const teams = await getTeams();
  const projectHub = getProjectHubApiService();
  const workspaces = (await projectHub.getStatus()).workspaces;
  const [projects, membersByTeam] = await Promise.all([
    Promise.all(workspaces.map((workspace) => projectHub.listProjects({ workspaceId: workspace.id })))
      .then((results) => results.flatMap((result) => result.success ? result.data || [] : [])),
    Promise.all(teams.map((team) => getTeamMembersDetailed(team.team_id))),
  ]);
  return { teams, projects, teamMembers: membersByTeam.flat() };
}
