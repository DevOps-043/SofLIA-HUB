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
  bulkLabelsToVerify: Set<string> | null,
): Promise<{ response: FunctionResponse; bulkLabelsToVerify: Set<string> | null } | null> {
  if (!GOOGLE_TOOLS.has(toolName)) return null;

  return (
    await executeCalendarTool(toolName, toolArgs, ctx, bulkLabelsToVerify)
    || await executeGmailMailTool(toolName, toolArgs, ctx, bulkLabelsToVerify)
    || await executeGmailPlanTool(toolName, toolArgs, ctx, bulkLabelsToVerify)
    || await executeGmailLabelTool(toolName, toolArgs, ctx, bulkLabelsToVerify)
    || await executeDriveTool(toolName, toolArgs, ctx, bulkLabelsToVerify)
    || await executeGChatTool(toolName, toolArgs, ctx, bulkLabelsToVerify)
  );
}
