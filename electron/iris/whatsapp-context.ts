/**
 * Construcción del contexto IRIS embebido en el system prompt del agente WhatsApp.
 *
 * El agente recibe un resumen estructurado de equipos, proyectos e issues que
 * el LLM puede consultar sin necesidad de hacer tool calls. Esto reduce
 * latencia para preguntas comunes ("¿cuáles son mis tareas?", "¿qué proyectos
 * hay?") al precio de tokens en el system prompt.
 *
 * También expone `needsIrisData(message)` para que el agente decida si vale
 * la pena cargar este contexto (cargarlo siempre encarecería todos los chats).
 */

import { getIrisClient } from './clients';
import { fetchIssues } from './issues';
import { fetchProjectsByTeamId } from './projects';
import { getTeams } from './teams';
import { fetchTeamMembersDetailedByTeamId } from './teams';

const TEAM_PREVIEW_LIMIT = 5;
const MEMBER_PREVIEW_LIMIT = 5;
const PROJECTS_LIMIT = 10;
const USER_ISSUES_LIMIT = 20;
const TEAMS_FOR_ISSUES_LIMIT = 3;
const ISSUES_PER_TEAM_LIMIT = 15;
const TOTAL_ISSUES_LIMIT = 30;

/**
 * Construye un string con datos IRIS para inyectar en el system prompt.
 * Si el usuario está autenticado (`userId`), incluye sus tareas asignadas.
 */
export async function buildIrisContextForWhatsApp(userId?: string): Promise<string> {
  const iris = getIrisClient();
  if (!iris) return '';

  try {
    const parts: string[] = ['=== DATOS DE IRIS (Project Hub) ==='];

    const teams = await getTeams();
    const teamById = new Map(teams.map((team) => [team.team_id, team]));

    if (teams.length > 0) {
      parts.push('\n## Equipos:');
      for (const team of teams.slice(0, TEAM_PREVIEW_LIMIT)) {
        parts.push(
          `- ${team.name} (${team.slug}) | Estado: ${team.status} | ID: ${team.team_id}`,
        );
        const members = await fetchTeamMembersDetailedByTeamId(team.team_id);
        if (members.length > 0) {
          const preview = members
            .slice(0, MEMBER_PREVIEW_LIMIT)
            .map((m) => m.display_name || m.username || m.email || m.user_id)
            .join(', ');
          parts.push(`  Miembros: ${preview}`);
        }
      }
    }

    const projects = await fetchProjectsByTeamId(null);
    const projectById = new Map(projects.map((p) => [p.project_id, p]));

    if (projects.length > 0) {
      parts.push('\n## Proyectos:');
      for (const proj of projects.slice(0, PROJECTS_LIMIT)) {
        const teamName = proj.team_id
          ? teamById.get(proj.team_id)?.name || proj.team_id
          : 'Sin equipo';
        const description = proj.project_description
          ? ` | Descripcion: ${proj.project_description}`
          : '';
        parts.push(
          `- ${proj.project_name} [${proj.project_key}] | Equipo: ${teamName} | Estado: ${proj.project_status} | Progreso: ${proj.completion_percentage}% | Prioridad: ${proj.priority_level} | ID: ${proj.project_id}${description}`,
        );
      }
    }

    if (userId) {
      const myIssues = await fetchIssues({ assigneeId: userId, limit: USER_ISSUES_LIMIT });
      if (myIssues.length > 0) {
        parts.push('\n## Mis tareas asignadas:');
        for (const issue of myIssues) {
          const statusName = issue.status?.name || 'Sin estado';
          const priorityName = issue.priority?.name || 'Sin prioridad';
          const projectName = issue.project_id
            ? projectById.get(issue.project_id)?.project_name || issue.project_id
            : 'Sin proyecto';
          const dueStr = issue.due_date ? ` | Vence: ${issue.due_date}` : '';
          parts.push(
            `- #${issue.issue_number} ${issue.title} | Proyecto: ${projectName} | Estado: ${statusName} | Prioridad: ${priorityName}${dueStr}`,
          );
        }
      }
    }

    if (teams.length > 0) {
      let totalIssues = 0;
      for (const team of teams.slice(0, TEAMS_FOR_ISSUES_LIMIT)) {
        if (totalIssues >= TOTAL_ISSUES_LIMIT) break;
        const issues = await fetchIssues({
          teamId: team.team_id,
          limit: Math.min(ISSUES_PER_TEAM_LIMIT, TOTAL_ISSUES_LIMIT - totalIssues),
        });
        if (issues.length > 0) {
          parts.push(`\n## Issues (equipo: ${team.name}):`);
          for (const issue of issues) {
            const statusName = issue.status?.name || 'Sin estado';
            const priorityName = issue.priority?.name || 'Sin prioridad';
            const projectName = issue.project_id
              ? projectById.get(issue.project_id)?.project_name || issue.project_id
              : 'Sin proyecto';
            const assigneeStr = issue.assignee_id
              ? ` | Asignado: ${issue.assignee_id}`
              : ' | Sin asignar';
            parts.push(
              `- #${issue.issue_number} ${issue.title} | Proyecto: ${projectName} | Estado: ${statusName} | Prioridad: ${priorityName}${assigneeStr}`,
            );
            totalIssues += 1;
          }
        }
      }
    }

    if (parts.length <= 1) return '';
    parts.push('\n=== FIN DATOS IRIS ===');
    return parts.join('\n');
  } catch (err) {
    console.error('[IRIS-Main] buildIrisContext error:', err);
    return '';
  }
}

const IRIS_KEYWORDS = [
  'proyecto', 'proyectos', 'project', 'projects',
  'issue', 'issues', 'tarea', 'tareas', 'task', 'tasks',
  'equipo', 'equipos', 'team', 'teams',
  'sprint', 'ciclo', 'cycle',
  'pendiente', 'pendientes',
  'estado de', 'status',
  'prioridad', 'priority',
  'asignar', 'assignee', 'asignadas', 'asignado',
  'backlog', 'kanban',
  'project hub', 'iris',
  'crear proyecto', 'crear tarea', 'create project', 'create task',
  'actualizar', 'update',
  'mis tareas', 'my tasks',
  'avance', 'progreso', 'progress',
  'login', 'inicio de sesion', 'iniciar sesion', 'iniciar sesión',
  'cerrar sesion', 'cerrar sesión', 'logout',
  'autenticar', 'authenticate',
];

export function needsIrisData(message: string): boolean {
  const lower = message.toLowerCase();
  return IRIS_KEYWORDS.some((kw) => lower.includes(kw));
}
