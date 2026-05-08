import {
  createProject as irisCreateProject,
  getWhatsAppSession,
  updateIssueStatus as irisUpdateIssueStatus,
  updateProjectStatus as irisUpdateProjectStatus,
} from '../../iris-data-main';
import type { FunctionResponse } from '../types';
import { toolResponse } from '../types';

export async function updateTaskStatus(
  toolName: string,
  toolArgs: Record<string, any>,
): Promise<FunctionResponse> {
  try {
    const result = await irisUpdateIssueStatus({
      issueId: toolArgs.issue_id,
      issueNumber: toolArgs.issue_number,
      teamId: toolArgs.team_id,
      newStatusName: toolArgs.new_status_name,
      newStatusId: toolArgs.new_status_id,
    });
    return toolResponse(toolName, result);
  } catch (err: any) {
    return toolResponse(toolName, { success: false, message: err.message });
  }
}

export async function createProject(
  toolName: string,
  toolArgs: Record<string, any>,
  senderNumber: string,
): Promise<FunctionResponse> {
  const currentSession = getWhatsAppSession(senderNumber);
  if (!currentSession) return toolResponse(toolName, { success: false, message: 'No has iniciado sesion.' });

  try {
    const result = await irisCreateProject({
      projectName: toolArgs.project_name,
      projectKey: toolArgs.project_key || undefined,
      createdByUserId: currentSession.userId,
      teamId: toolArgs.team_id,
      teamName: toolArgs.team_name,
      description: toolArgs.description,
      priorityLevel: toolArgs.priority_level,
      startDate: toolArgs.start_date,
      targetDate: toolArgs.target_date,
    });
    return toolResponse(toolName, result);
  } catch (err: any) {
    return toolResponse(toolName, { success: false, message: err.message });
  }
}

export async function updateProjectStatus(
  toolName: string,
  toolArgs: Record<string, any>,
): Promise<FunctionResponse> {
  try {
    const result = await irisUpdateProjectStatus({
      projectId: toolArgs.project_id,
      newStatus: toolArgs.new_status,
    });
    return toolResponse(toolName, result);
  } catch (err: any) {
    return toolResponse(toolName, { success: false, message: err.message });
  }
}
