import { getProjects, getTeamMembersDetailed, getTeams, type IrisTeamMemberDetail } from '../../iris-data-main';

export async function getMeetingWorkflowContext(): Promise<{ teams: any[]; projects: any[]; teamMembers: IrisTeamMemberDetail[] }> {
  const teams = await getTeams();
  const [projects, membersByTeam] = await Promise.all([
    getProjects(),
    Promise.all(teams.map((team) => getTeamMembersDetailed(team.team_id))),
  ]);
  return { teams, projects, teamMembers: membersByTeam.flat() };
}
