import { toolError, toolResponse } from '../types';
import type { ToolExecutorContext } from '../types';
import type { GoogleExecutorResult } from './types';

const GMAIL_PLAN_TOOLS = new Set([
  'gmail_preview_organization',
  'gmail_apply_organization_plan',
  'gmail_undo_organization_plan',
]);

export async function executeGmailPlanTool(
  toolName: string,
  toolArgs: Record<string, any>,
  ctx: ToolExecutorContext,
  bulkLabelsToVerify: Set<string> | null,
): Promise<GoogleExecutorResult | null> {
  if (!GMAIL_PLAN_TOOLS.has(toolName)) return null;

  try {
    if (!ctx.gmailService) return { response: toolError(toolName, 'Gmail no conectado.'), bulkLabelsToVerify };

    if (toolName === 'gmail_preview_organization') {
      return {
        response: toolResponse(toolName, await ctx.gmailService.previewOrganizationPlan({
          query: toolArgs.query,
          maxMessages: toolArgs.max_messages,
          minGroupSize: toolArgs.min_group_size,
          removeFromInbox: toolArgs.remove_from_inbox,
          pageLimit: toolArgs.page_limit,
        })),
        bulkLabelsToVerify,
      };
    }

    if (toolName === 'gmail_apply_organization_plan') {
      return {
        response: toolResponse(toolName, await ctx.gmailService.applyOrganizationPlan(toolArgs.plan_id, {
          removeFromInbox: toolArgs.remove_from_inbox,
        })),
        bulkLabelsToVerify,
      };
    }

    return {
      response: toolResponse(toolName, await ctx.gmailService.undoOrganizationPlan(toolArgs.plan_id)),
      bulkLabelsToVerify,
    };
  } catch (err: any) {
    return { response: toolError(toolName, err.message), bulkLabelsToVerify };
  }
}
