/**
 * IRIS / Project Hub tool executors.
 */
import {
  authenticateWhatsAppUser,
  getWhatsAppSession,
  logoutWhatsAppUser,
  getTeams as irisGetTeams,
  getProjects as irisGetProjects,
  getIssues as irisGetIssues,
  getStatuses as irisGetStatuses,
  getPriorities as irisGetPriorities,
  createIssue as irisCreateIssue,
  updateIssueStatus as irisUpdateIssueStatus,
  createProject as irisCreateProject,
  updateProjectStatus as irisUpdateProjectStatus,
} from '../iris-data-main';
import type { FunctionResponse } from './types';
import { toolResponse } from './types';

const IRIS_TOOLS = new Set([
  'iris_login', 'iris_logout', 'iris_get_my_tasks', 'iris_get_projects',
  'iris_get_teams', 'iris_get_issues', 'iris_get_statuses', 'iris_create_task',
  'iris_update_task_status', 'iris_create_project', 'iris_update_project_status',
]);

export function isIrisTool(name: string): boolean {
  return IRIS_TOOLS.has(name);
}

export async function executeIrisTool(
  toolName: string,
  toolArgs: Record<string, any>,
  senderNumber: string,
): Promise<FunctionResponse | null> {
  if (!IRIS_TOOLS.has(toolName)) return null;

  if (toolName === 'iris_login') {
    try {
      const result = await authenticateWhatsAppUser(senderNumber, toolArgs.email, toolArgs.password);
      return toolResponse(toolName, result);
    } catch (err: any) {
      return toolResponse(toolName, { success: false, message: err.message });
    }
  }

  if (toolName === 'iris_logout') {
    const success = logoutWhatsAppUser(senderNumber);
    return toolResponse(toolName, { success, message: success ? 'Sesión cerrada correctamente.' : 'No tenías sesión activa.' });
  }

  if (toolName === 'iris_get_my_tasks') {
    const currentSession = getWhatsAppSession(senderNumber);
    if (!currentSession) {
      return toolResponse(toolName, { success: false, message: 'No has iniciado sesión. Envía tu email y contraseña para autenticarte.' });
    }
    try {
      const issues = await irisGetIssues({ assigneeId: currentSession.userId, projectId: toolArgs.project_id, limit: toolArgs.limit || 20 });
      const formatted = issues.map(i => ({
        number: i.issue_number, title: i.title,
        status: i.status?.name || 'Sin estado', priority: i.priority?.name || 'Sin prioridad',
        due_date: i.due_date || null, project_id: i.project_id || null,
      }));
      return toolResponse(toolName, { success: true, tasks: formatted, count: formatted.length, user: currentSession.fullName });
    } catch (err: any) {
      return toolResponse(toolName, { success: false, message: err.message });
    }
  }

  if (toolName === 'iris_get_projects') {
    try {
      const projects = await irisGetProjects(toolArgs.team_id);
      const formatted = projects.map(p => ({
        name: p.project_name, key: p.project_key, status: p.project_status,
        progress: p.completion_percentage, priority: p.priority_level, id: p.project_id,
      }));
      return toolResponse(toolName, { success: true, projects: formatted, count: formatted.length });
    } catch (err: any) {
      return toolResponse(toolName, { success: false, message: err.message });
    }
  }

  if (toolName === 'iris_get_teams') {
    try {
      const teams = await irisGetTeams();
      const formatted = teams.map(t => ({ name: t.name, slug: t.slug, status: t.status, id: t.team_id }));
      return toolResponse(toolName, { success: true, teams: formatted, count: formatted.length });
    } catch (err: any) {
      return toolResponse(toolName, { success: false, message: err.message });
    }
  }

  if (toolName === 'iris_get_issues') {
    try {
      const issues = await irisGetIssues({
        teamId: toolArgs.team_id, projectId: toolArgs.project_id,
        assigneeId: toolArgs.assignee_id, limit: toolArgs.limit || 20,
      });
      const formatted = issues.map(i => ({
        number: i.issue_number, title: i.title,
        status: i.status?.name || 'Sin estado', priority: i.priority?.name || 'Sin prioridad',
        assignee_id: i.assignee_id || 'Sin asignar', due_date: i.due_date || null, project_id: i.project_id || null,
      }));
      return toolResponse(toolName, { success: true, issues: formatted, count: formatted.length });
    } catch (err: any) {
      return toolResponse(toolName, { success: false, message: err.message });
    }
  }

  if (toolName === 'iris_get_statuses') {
    try {
      const statuses = await irisGetStatuses(toolArgs.team_id);
      const priorities = await irisGetPriorities();
      return toolResponse(toolName, { success: true, statuses, priorities });
    } catch (err: any) {
      return toolResponse(toolName, { success: false, message: err.message });
    }
  }

  if (toolName === 'iris_create_task') {
    const currentSession = getWhatsAppSession(senderNumber);
    if (!currentSession) return toolResponse(toolName, { success: false, message: 'No has iniciado sesión.' });
    try {
      const result = await irisCreateIssue({
        teamId: toolArgs.team_id, title: toolArgs.title, creatorId: currentSession.userId,
        description: toolArgs.description, projectId: toolArgs.project_id,
        priorityId: toolArgs.priority_id, assigneeId: toolArgs.assignee_id, dueDate: toolArgs.due_date,
      });
      return toolResponse(toolName, result);
    } catch (err: any) {
      return toolResponse(toolName, { success: false, message: err.message });
    }
  }

  if (toolName === 'iris_update_task_status') {
    try {
      const result = await irisUpdateIssueStatus({
        issueId: toolArgs.issue_id, issueNumber: toolArgs.issue_number,
        teamId: toolArgs.team_id, newStatusName: toolArgs.new_status_name, newStatusId: toolArgs.new_status_id,
      });
      return toolResponse(toolName, result);
    } catch (err: any) {
      return toolResponse(toolName, { success: false, message: err.message });
    }
  }

  if (toolName === 'iris_create_project') {
    const currentSession = getWhatsAppSession(senderNumber);
    if (!currentSession) return toolResponse(toolName, { success: false, message: 'No has iniciado sesión.' });
    try {
      const result = await irisCreateProject({
        projectName: toolArgs.project_name, projectKey: toolArgs.project_key || '',
        createdByUserId: currentSession.userId, teamId: toolArgs.team_id,
        description: toolArgs.description, priorityLevel: toolArgs.priority_level,
        startDate: toolArgs.start_date, targetDate: toolArgs.target_date,
      });
      return toolResponse(toolName, result);
    } catch (err: any) {
      return toolResponse(toolName, { success: false, message: err.message });
    }
  }

  if (toolName === 'iris_update_project_status') {
    try {
      const result = await irisUpdateProjectStatus({ projectId: toolArgs.project_id, newStatus: toolArgs.new_status });
      return toolResponse(toolName, result);
    } catch (err: any) {
      return toolResponse(toolName, { success: false, message: err.message });
    }
  }

  return null;
}
