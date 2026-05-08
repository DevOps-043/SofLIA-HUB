import type { IrisProject, IrisTeam } from '../types';
import { fetchIssues } from '../issues';
import { fetchTeamMembersDetailedByTeamId } from '../teams';
import {
  ISSUES_PER_TEAM_LIMIT,
  MEMBER_PREVIEW_LIMIT,
  PROJECTS_LIMIT,
  TEAM_PREVIEW_LIMIT,
  TEAMS_FOR_ISSUES_LIMIT,
  TOTAL_ISSUES_LIMIT,
  USER_ISSUES_LIMIT,
} from './limits';

export async function appendTeamContext(parts: string[], teams: IrisTeam[]) {
  if (teams.length === 0) return;

  parts.push('\n## Equipos:');
  for (const team of teams.slice(0, TEAM_PREVIEW_LIMIT)) {
    parts.push(`- ${team.name} (${team.slug}) | Estado: ${team.status} | ID: ${team.team_id}`);
    const members = await fetchTeamMembersDetailedByTeamId(team.team_id);
    if (members.length > 0) {
      const preview = members
        .slice(0, MEMBER_PREVIEW_LIMIT)
        .map((member) => member.display_name || member.username || member.email || member.user_id)
        .join(', ');
      parts.push(`  Miembros: ${preview}`);
    }
  }
}

export function appendProjectContext(
  parts: string[],
  projects: IrisProject[],
  teamById: Map<string, IrisTeam>,
) {
  if (projects.length === 0) return;

  parts.push('\n## Proyectos:');
  for (const project of projects.slice(0, PROJECTS_LIMIT)) {
    const teamName = project.team_id ? teamById.get(project.team_id)?.name || project.team_id : 'Sin equipo';
    const description = project.project_description ? ` | Descripcion: ${project.project_description}` : '';
    parts.push(
      `- ${project.project_name} [${project.project_key}] | Equipo: ${teamName} | Estado: ${project.project_status} | Progreso: ${project.completion_percentage}% | Prioridad: ${project.priority_level} | ID: ${project.project_id}${description}`,
    );
  }
}

export async function appendAssignedIssuesContext(
  parts: string[],
  userId: string,
  projectById: Map<string, IrisProject>,
) {
  const myIssues = await fetchIssues({ assigneeId: userId, limit: USER_ISSUES_LIMIT });
  if (myIssues.length === 0) return;

  parts.push('\n## Mis tareas asignadas:');
  for (const issue of myIssues) {
    parts.push(formatIssueLine(issue, projectById, false));
  }
}

export async function appendTeamIssuesContext(
  parts: string[],
  teams: IrisTeam[],
  projectById: Map<string, IrisProject>,
) {
  let totalIssues = 0;
  for (const team of teams.slice(0, TEAMS_FOR_ISSUES_LIMIT)) {
    if (totalIssues >= TOTAL_ISSUES_LIMIT) break;
    const issues = await fetchIssues({ teamId: team.team_id, limit: Math.min(ISSUES_PER_TEAM_LIMIT, TOTAL_ISSUES_LIMIT - totalIssues) });
    if (issues.length === 0) continue;

    parts.push(`\n## Issues (equipo: ${team.name}):`);
    for (const issue of issues) {
      parts.push(formatIssueLine(issue, projectById, true));
      totalIssues += 1;
    }
  }
}

function formatIssueLine(issue: any, projectById: Map<string, IrisProject>, includeAssignee: boolean) {
  const statusName = issue.status?.name || 'Sin estado';
  const priorityName = issue.priority?.name || 'Sin prioridad';
  const projectName = issue.project_id ? projectById.get(issue.project_id)?.project_name || issue.project_id : 'Sin proyecto';
  const dueStr = issue.due_date ? ` | Vence: ${issue.due_date}` : '';
  const assigneeStr = includeAssignee ? (issue.assignee_id ? ` | Asignado: ${issue.assignee_id}` : ' | Sin asignar') : '';
  return `- #${issue.issue_number} ${issue.title} | Proyecto: ${projectName} | Estado: ${statusName} | Prioridad: ${priorityName}${dueStr}${assigneeStr}`;
}
