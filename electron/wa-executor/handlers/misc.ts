import { errorResponse, type FunctionResponse, type ToolExecutorContext } from '../types';
import { createCalendarEvent } from './misc/calendar-event';
import { executeSearchTool } from './misc/search-tools';
import { executeServiceTool } from './misc/service-tools';
import { ALL_MISC_TOOLS } from './misc/tool-sets';

export function isMiscTool(name: string): boolean {
  return ALL_MISC_TOOLS.has(name);
}

export async function executeMiscTool(
  toolName: string,
  toolArgs: Record<string, any>,
  ctx: ToolExecutorContext,
  senderNumber: string,
): Promise<FunctionResponse | null> {
  if (!ALL_MISC_TOOLS.has(toolName)) return null;

  try {
    const searchResult = await executeSearchTool(toolName, toolArgs, ctx);
    if (searchResult) return searchResult;

    const serviceResult = await executeServiceTool(toolName, toolArgs, ctx, senderNumber);
    if (serviceResult) return serviceResult;

    if (toolName === 'create_calendar_event') {
      return createCalendarEvent(toolArgs);
    }

    return null;
  } catch (err: any) {
    return errorResponse(toolName, err.message);
  }
}
