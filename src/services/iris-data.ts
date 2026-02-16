/**
 * IRIS Data Service
 * Handles read operations for the IRIS project management system.
 */

import {
  irisSupa,
  isIrisConfigured,
  type IrisTeam,
  type IrisProject,
  type IrisIssue,
  type IrisStatus,
  type IrisPriority,
} from '../lib/iris-client';

// ==========================================
// TEAMS
// ==========================================

export async function getTeams(): Promise<IrisTeam[]> {
  if (!irisSupa || !isIrisConfigured()) return [];
  const { data, error } = await irisSupa
    .from('teams')
    .select('*')
    .eq('status', 'active')
    .order('name');
  if (error) { console.error('IRIS: getTeams error', error); return []; }
  return data || [];
}

// ==========================================
// PROJECTS
// ==========================================

export async function getProjects(teamId?: string): Promise<IrisProject[]> {
  if (!irisSupa || !isIrisConfigured()) return [];
  let query = irisSupa
    .from('pm_projects')
    .select('*')
    .is('archived_at', null)
    .order('updated_at', { ascending: false });
  if (teamId) query = query.eq('team_id', teamId);
  const { data, error } = await query;
  if (error) { console.error('IRIS: getProjects error', error); return []; }
  return data || [];
}

// ==========================================
// ISSUES
// ==========================================

export async function getIssues(filters?: {
  teamId?: string;
  projectId?: string;
  limit?: number;
}): Promise<IrisIssue[]> {
  if (!irisSupa || !isIrisConfigured()) return [];
  let query = irisSupa
    .from('task_issues')
    .select('*, status:task_statuses(*), priority:task_priorities(*)')
    .is('archived_at', null)
    .order('updated_at', { ascending: false });

  if (filters?.teamId) query = query.eq('team_id', filters.teamId);
  if (filters?.projectId) query = query.eq('project_id', filters.projectId);
  query = query.limit(filters?.limit || 20);

  const { data, error } = await query;
  if (error) { console.error('IRIS: getIssues error', error); return []; }
  return data || [];
}

// ==========================================
// STATUSES & PRIORITIES
// ==========================================

export async function getStatuses(teamId: string): Promise<IrisStatus[]> {
  if (!irisSupa || !isIrisConfigured()) return [];
  const { data, error } = await irisSupa
    .from('task_statuses')
    .select('*')
    .eq('team_id', teamId)
    .order('position');
  if (error) { console.error('IRIS: getStatuses error', error); return []; }
  return data || [];
}

export async function getPriorities(): Promise<IrisPriority[]> {
  if (!irisSupa || !isIrisConfigured()) return [];
  const { data, error } = await irisSupa
    .from('task_priorities')
    .select('*')
    .order('level');
  if (error) { console.error('IRIS: getPriorities error', error); return []; }
  return data || [];
}

// ==========================================
// COLOR HELPERS
// ==========================================

export const PROJECT_STATUS_COLORS: Record<string, string> = {
  active: '#22c55e',
  completed: '#3b82f6',
  on_hold: '#f59e0b',
  planning: '#8b5cf6',
  cancelled: '#ef4444',
  archived: '#6b7280',
};

export const ISSUE_STATUS_TYPE_COLORS: Record<string, string> = {
  done: '#22c55e',
  in_progress: '#3b82f6',
  in_review: '#8b5cf6',
  todo: '#f59e0b',
  backlog: '#6b7280',
  cancelled: '#ef4444',
};

// ==========================================
// CONTEXT BUILDER (for Gemini prompt)
// ==========================================

const IRIS_KEYWORDS = [
  'proyecto', 'proyectos', 'project', 'projects',
  'issue', 'issues', 'tarea', 'tareas', 'task', 'tasks',
  'equipo', 'equipos', 'team', 'teams',
  'sprint', 'ciclo', 'cycle',
  'milestone', 'hito',
  'pendiente', 'pendientes',
  'estado de', 'status',
  'prioridad', 'priority',
  'asignar', 'assignee',
  'backlog', 'kanban',
  'project hub', 'iris',
  'crear proyecto', 'crear tarea', 'create project', 'create task',
  'actualizar', 'update',
  'mis tareas', 'my tasks',
  'avance', 'progreso', 'progress',
];

export function needsIrisData(message: string): boolean {
  const lower = message.toLowerCase();
  return IRIS_KEYWORDS.some(kw => lower.includes(kw));
}

export async function buildIrisContext(): Promise<string> {
  if (!irisSupa || !isIrisConfigured()) return '';

  try {
    const parts: string[] = ['=== DATOS DE IRIS (Project Hub) ==='];

    const teams = await getTeams();
    if (teams.length > 0) {
      parts.push('\n## Equipos:');
      for (const team of teams.slice(0, 5)) {
        parts.push(`- ${team.name} (${team.slug}) | Estado: ${team.status} | ID: ${team.team_id}`);
      }
    }

    const projects = await getProjects();
    if (projects.length > 0) {
      parts.push('\n## Proyectos:');
      for (const proj of projects.slice(0, 10)) {
        parts.push(`- ${proj.project_name} [${proj.project_key}] | Estado: ${proj.project_status} | Progreso: ${proj.completion_percentage}% | Prioridad: ${proj.priority_level} | ID: ${proj.project_id}`);
      }
    }

    if (teams.length > 0) {
      let totalIssues = 0;
      for (const team of teams.slice(0, 3)) {
        if (totalIssues >= 30) break;
        const issues = await getIssues({ teamId: team.team_id, limit: Math.min(15, 30 - totalIssues) });
        if (issues.length > 0) {
          parts.push(`\n## Issues (equipo: ${team.name}):`);
          for (const issue of issues) {
            const statusName = issue.status?.name || 'Sin estado';
            const priorityName = issue.priority?.name || 'Sin prioridad';
            parts.push(`- #${issue.issue_number} ${issue.title} | Estado: ${statusName} | Prioridad: ${priorityName} | ID: ${issue.issue_id}`);
            totalIssues++;
          }
        }
      }
    }

    if (parts.length <= 1) return '';
    parts.push('\n=== FIN DATOS IRIS ===');
    return parts.join('\n');
  } catch (err) {
    console.error('IRIS: Error building context', err);
    return '';
  }
}
