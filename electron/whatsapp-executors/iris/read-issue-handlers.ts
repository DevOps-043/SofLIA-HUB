import {
  getIssues as irisGetIssues,
  getPriorities as irisGetPriorities,
  getStatuses as irisGetStatuses,
} from '../../iris-data-main';
import type { FunctionResponse } from '../types';
import { toolResponse } from '../types';

export async function getIssues(
  toolName: string,
  toolArgs: Record<string, any>,
): Promise<FunctionResponse> {
  try {
    const issues = await irisGetIssues({
      teamId: toolArgs.team_id,
      projectId: toolArgs.project_id,
      assigneeId: toolArgs.assignee_id,
      limit: toolArgs.limit || 20,
    });
    const formatted = issues.map((issue) => ({
      number: issue.issue_number,
      title: issue.title,
      status: issue.status?.name || 'Sin estado',
      priority: issue.priority?.name || 'Sin prioridad',
      assignee_id: issue.assignee_id || 'Sin asignar',
      due_date: issue.due_date || null,
      project_id: issue.project_id || null,
    }));
    return toolResponse(toolName, { success: true, issues: formatted, count: formatted.length });
  } catch (err: any) {
    return toolResponse(toolName, { success: false, message: err.message });
  }
}

export async function getStatuses(
  toolName: string,
  toolArgs: Record<string, any>,
): Promise<FunctionResponse> {
  const teamRef = toolArgs.team_id || toolArgs.team_name;
  if (!teamRef) {
    return toolResponse(toolName, {
      success: false,
      message: 'Debes indicar team_id o team_name para consultar estados.',
    });
  }

  try {
    const statuses = await irisGetStatuses(teamRef);
    const priorities = await irisGetPriorities();
    return toolResponse(toolName, { success: true, statuses, priorities });
  } catch (err: any) {
    return toolResponse(toolName, { success: false, message: err.message });
  }
}
