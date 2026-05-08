import {
  authenticateWhatsAppUser,
  getIssues as irisGetIssues,
  getWhatsAppSession,
  logoutWhatsAppUser,
} from '../../iris-data-main';
import type { FunctionResponse } from '../types';
import { toolResponse } from '../types';

export async function handleIrisAuthTool(
  toolName: string,
  toolArgs: Record<string, any>,
  senderNumber: string,
): Promise<FunctionResponse | null> {
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
    return toolResponse(toolName, {
      success,
      message: success ? 'Sesion cerrada correctamente.' : 'No tenias sesion activa.',
    });
  }

  if (toolName === 'iris_get_my_tasks') {
    const currentSession = getWhatsAppSession(senderNumber);
    if (!currentSession) {
      return toolResponse(toolName, {
        success: false,
        message: 'No has iniciado sesion. Envia tu email y contrasena para autenticarte.',
      });
    }

    try {
      const issues = await irisGetIssues({
        assigneeId: currentSession.userId,
        projectId: toolArgs.project_id,
        limit: toolArgs.limit || 20,
      });
      const formatted = issues.map((issue) => ({
        number: issue.issue_number,
        title: issue.title,
        status: issue.status?.name || 'Sin estado',
        priority: issue.priority?.name || 'Sin prioridad',
        due_date: issue.due_date || null,
        project_id: issue.project_id || null,
      }));
      return toolResponse(toolName, {
        success: true,
        tasks: formatted,
        count: formatted.length,
        user: currentSession.fullName,
      });
    } catch (err: any) {
      return toolResponse(toolName, { success: false, message: err.message });
    }
  }

  return null;
}
