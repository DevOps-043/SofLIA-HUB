import type { ToolExecutorContext, FunctionResponse } from './types';
import { executeCalendarTool } from './google-executors/calendar';
import { executeDriveTool } from './google-executors/drive';
import { executeGChatTool } from './google-executors/gchat';
import { executeGmailLabelTool } from './google-executors/gmail-labels';
import { executeGmailMailTool } from './google-executors/gmail-mail';
import { executeGmailPlanTool } from './google-executors/gmail-plans';
import { GOOGLE_TOOLS } from './google-executors/tool-set';

export function isGoogleTool(name: string): boolean {
  return GOOGLE_TOOLS.has(name);
}

export async function executeGoogleTool(
  toolName: string,
  toolArgs: Record<string, any>,
  ctx: ToolExecutorContext,
): Promise<{ response: FunctionResponse } | null> {
  if (!GOOGLE_TOOLS.has(toolName)) return null;

  return (
    await executeCalendarTool(toolName, toolArgs, ctx)
    || await executeGmailMailTool(toolName, toolArgs, ctx)
    || await executeGmailPlanTool(toolName, toolArgs, ctx)
    || await executeGmailLabelTool(toolName, toolArgs, ctx)
    || await executeDriveTool(toolName, toolArgs, ctx)
    || await executeGChatTool(toolName, toolArgs, ctx)
  );
}
