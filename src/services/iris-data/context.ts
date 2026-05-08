import { irisSupa, isIrisConfigured } from '../../lib/iris-client';
import { getIssues } from './issues';
import { getProjects } from './projects';
import { getTeams } from './teams';

export async function buildIrisContext(): Promise<string> {
  if (!irisSupa || !isIrisConfigured()) return '';
  try {
    const parts: string[] = ['=== DATOS DE IRIS (Project Hub) ==='];
    const teams = await getTeams();
    const teamById = new Map(teams.map((team) => [team.team_id, team]));
    if (teams.length) {
      parts.push('\n## Equipos:');
      for (const team of teams.slice(0, 5)) parts.push(`- ${team.name} (${team.slug}) | Estado: ${team.status} | ID: ${team.team_id}`);
    }

    const projects = await getProjects();
    const projectById = new Map(projects.map((project) => [project.project_id, project]));
    if (projects.length) {
      parts.push('\n## Proyectos:');
      for (const project of projects.slice(0, 10)) {
        const teamName = project.team_id ? teamById.get(project.team_id)?.name || project.team_id : 'Sin equipo';
        const description = project.project_description ? ` | Descripcion: ${project.project_description}` : '';
        parts.push(`- ${project.project_name} [${project.project_key}] | Equipo: ${teamName} | Estado: ${project.project_status} | Progreso: ${project.completion_percentage}% | Prioridad: ${project.priority_level} | ID: ${project.project_id}${description}`);
      }
    }

    let totalIssues = 0;
    for (const team of teams.slice(0, 3)) {
      if (totalIssues >= 30) break;
      const issues = await getIssues({ teamId: team.team_id, limit: Math.min(15, 30 - totalIssues) });
      if (!issues.length) continue;
      parts.push(`\n## Issues (equipo: ${team.name}):`);
      for (const issue of issues) {
        const projectName = issue.project_id ? projectById.get(issue.project_id)?.project_name || issue.project_id : 'Sin proyecto';
        parts.push(`- #${issue.issue_number} ${issue.title} | Proyecto: ${projectName} | Estado: ${issue.status?.name || 'Sin estado'} | Prioridad: ${issue.priority?.name || 'Sin prioridad'} | ID: ${issue.issue_id}`);
        totalIssues += 1;
      }
    }

    if (parts.length <= 1) return '';
    parts.push('\n=== FIN DATOS IRIS ===');
    return parts.join('\n');
  } catch {
    return '';
  }
}
