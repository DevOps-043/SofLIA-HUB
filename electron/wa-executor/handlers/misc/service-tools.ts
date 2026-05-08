import { handleTaskQueueTool } from '../../../agent-task-queue';
import { handleTaskSchedulerTool } from '../../../task-scheduler';
import { buildResponse, errorResponse, type FunctionResponse, type ToolExecutorContext } from '../../types';
import { BROWSER_PROFILE_TOOLS, NEURAL_TOOLS, SCHEDULER_TOOLS, TASK_QUEUE_TOOLS } from './tool-sets';

export async function executeServiceTool(
  toolName: string,
  toolArgs: Record<string, any>,
  ctx: ToolExecutorContext,
  senderNumber: string,
): Promise<FunctionResponse | null> {
  if (BROWSER_PROFILE_TOOLS.has(toolName)) return executeBrowserProfileTool(toolName, toolArgs, ctx);
  if (SCHEDULER_TOOLS.has(toolName)) return executeSchedulerTool(toolName, toolArgs, ctx, senderNumber);
  if (TASK_QUEUE_TOOLS.has(toolName)) {
    return buildResponse(toolName, await handleTaskQueueTool(toolName, toolArgs));
  }
  if (NEURAL_TOOLS.has(toolName)) {
    if (!ctx.neuralOrganizer) {
      return errorResponse(toolName, 'Neural Organizer no inicializado. Configura primero la API key.');
    }
    return buildResponse(toolName, ctx.neuralOrganizer.handleToolCall(toolName, toolArgs));
  }
  return null;
}

async function executeBrowserProfileTool(
  toolName: string,
  toolArgs: Record<string, any>,
  ctx: ToolExecutorContext,
): Promise<FunctionResponse> {
  if (!ctx.desktopAgent) {
    return errorResponse(toolName, 'Desktop Agent no inicializado.');
  }
  if (toolName === 'list_browser_profiles') {
    const profiles = ctx.desktopAgent.listBrowserProfiles().map((profile) => ({ ...profile }));
    return buildResponse(toolName, { success: true, count: profiles.length, profiles });
  }
  const resetResult = await ctx.desktopAgent.resetBrowserProfile(String(toolArgs.profile_id || '').trim());
  if (typeof resetResult === 'object' && resetResult !== null) {
    return buildResponse(toolName, resetResult as Record<string, unknown>);
  }
  return buildResponse(toolName, { success: true, result: resetResult });
}

async function executeSchedulerTool(
  toolName: string,
  toolArgs: Record<string, any>,
  ctx: ToolExecutorContext,
  senderNumber: string,
): Promise<FunctionResponse> {
  if (!ctx.taskScheduler) {
    return errorResponse(toolName, 'Task Scheduler no inicializado.');
  }
  const result = await handleTaskSchedulerTool(ctx.taskScheduler, toolName, toolArgs, senderNumber);
  return buildResponse(toolName, result);
}
