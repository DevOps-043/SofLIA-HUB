import { executeCalendarTool } from './calendar-tools';
import { executeDriveTool } from './drive-tools';
import { executeGmailTool } from './gmail-tools';
import { getWorkspaceApis } from './workspace-api';

export async function executeGoogleWorkspaceTool(toolName: string, args: Record<string, any>): Promise<string> {
  const apis = getWorkspaceApis();
  const result =
    (await executeCalendarTool(toolName, args, apis)) ??
    (await executeGmailTool(toolName, args, apis)) ??
    (await executeDriveTool(toolName, args, apis));
  return result ?? JSON.stringify({ error: `Herramienta Google Workspace no implementada: ${toolName}` });
}
