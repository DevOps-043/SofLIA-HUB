import { toolError, toolResponse } from '../types';
import type { ToolExecutorContext } from '../types';
import type { GoogleExecutorResult } from './types';

const GCHAT_TOOLS = new Set([
  'gchat_list_spaces',
  'gchat_get_messages',
  'gchat_send_message',
  'gchat_add_reaction',
  'gchat_get_members',
]);

export async function executeGChatTool(
  toolName: string,
  toolArgs: Record<string, any>,
  ctx: ToolExecutorContext,
  bulkLabelsToVerify: Set<string> | null,
): Promise<GoogleExecutorResult | null> {
  if (!GCHAT_TOOLS.has(toolName)) return null;

  try {
    if (!ctx.gchatService) return { response: toolError(toolName, 'Google Chat no conectado.'), bulkLabelsToVerify };

    if (toolName === 'gchat_list_spaces') {
      return { response: toolResponse(toolName, await ctx.gchatService.listSpaces()), bulkLabelsToVerify };
    }
    if (toolName === 'gchat_get_messages') {
      return {
        response: toolResponse(toolName, await ctx.gchatService.getMessages(toolArgs.space_name, toolArgs.max_results)),
        bulkLabelsToVerify,
      };
    }
    if (toolName === 'gchat_send_message') {
      return {
        response: toolResponse(toolName, await ctx.gchatService.sendMessage(toolArgs.space_name, toolArgs.text, toolArgs.thread_name)),
        bulkLabelsToVerify,
      };
    }
    if (toolName === 'gchat_add_reaction') {
      return {
        response: toolResponse(toolName, await ctx.gchatService.addReaction(toolArgs.message_name, toolArgs.emoji)),
        bulkLabelsToVerify,
      };
    }

    return {
      response: toolResponse(toolName, await ctx.gchatService.getMembers(toolArgs.space_name)),
      bulkLabelsToVerify,
    };
  } catch (err: any) {
    return { response: toolError(toolName, err.message), bulkLabelsToVerify };
  }
}
