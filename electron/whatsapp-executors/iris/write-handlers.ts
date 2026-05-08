import {
  createIssue as irisCreateIssue,
  getWhatsAppSession,
} from '../../iris-data-main';
import type { FunctionResponse } from '../types';
import { toolResponse } from '../types';
import {
  createProject,
  updateProjectStatus,
  updateTaskStatus,
} from './write-project-handlers';

export async function handleIrisWriteTool(
  toolName: string,
  toolArgs: Record<string, any>,
  senderNumber: string,
): Promise<FunctionResponse | null> {
  if (toolName === 'iris_create_task') return createTask(toolName, toolArgs, senderNumber);
  if (toolName === 'iris_update_task_status') return updateTaskStatus(toolName, toolArgs);
  if (toolName === 'iris_create_project') return createProject(toolName, toolArgs, senderNumber);
  if (toolName === 'iris_update_project_status') return updateProjectStatus(toolName, toolArgs);
  return null;
}

async function createTask(
  toolName: string,
  toolArgs: Record<string, any>,
  senderNumber: string,
): Promise<FunctionResponse> {
  const currentSession = getWhatsAppSession(senderNumber);
  if (!currentSession) return toolResponse(toolName, { success: false, message: 'No has iniciado sesion.' });

  try {
    const result = await irisCreateIssue({
      teamId: toolArgs.team_id,
      teamName: toolArgs.team_name,
      title: toolArgs.title,
      creatorId: currentSession.userId,
      description: toolArgs.description,
      projectId: toolArgs.project_id,
      projectName: toolArgs.project_name,
      statusId: toolArgs.status_id,
      statusName: toolArgs.status_name,
      priorityId: toolArgs.priority_id,
      priorityName: toolArgs.priority_name,
      assigneeId: toolArgs.assignee_id,
      assigneeQuery: toolArgs.assignee_name || toolArgs.assignee_query,
      dueDate: toolArgs.due_date,
    });
    return toolResponse(toolName, result);
  } catch (err: any) {
    return toolResponse(toolName, { success: false, message: err.message });
  }
}
