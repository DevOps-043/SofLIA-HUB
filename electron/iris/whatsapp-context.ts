import { getIrisClient } from './clients';
import { fetchProjectsByTeamId } from './projects';
import { getTeams } from './teams';
import {
  appendAssignedIssuesContext,
  appendProjectContext,
  appendTeamContext,
  appendTeamIssuesContext,
} from './whatsapp-context/context-builders';

export { needsIrisData } from './whatsapp-context/keywords';

export async function buildIrisContextForWhatsApp(userId?: string): Promise<string> {
  const iris = getIrisClient();
  if (!iris) return '';

  try {
    const parts: string[] = ['=== DATOS DE IRIS (Project Hub) ==='];
    const teams = await getTeams();
    const teamById = new Map(teams.map((team) => [team.team_id, team]));

    await appendTeamContext(parts, teams);

    const projects = await fetchProjectsByTeamId(null);
    const projectById = new Map(projects.map((project) => [project.project_id, project]));
    appendProjectContext(parts, projects, teamById);

    if (userId) {
      await appendAssignedIssuesContext(parts, userId, projectById);
    }

    await appendTeamIssuesContext(parts, teams, projectById);

    if (parts.length <= 1) return '';
    parts.push('\n=== FIN DATOS IRIS ===');
    return parts.join('\n');
  } catch (err) {
    console.error('[IRIS-Main] buildIrisContext error:', err);
    return '';
  }
}
