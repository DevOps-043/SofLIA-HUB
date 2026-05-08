import { toolError, toolResponse } from '../types';
import type { ToolExecutorContext } from '../types';
import type { GoogleExecutorResult } from './types';

const SYSTEM_LABELS = new Set(['INBOX', 'UNREAD', 'SPAM', 'TRASH', 'SENT', 'DRAFT']);
const GMAIL_LABEL_TOOLS = new Set([
  'gmail_get_labels',
  'gmail_create_label',
  'gmail_delete_label',
  'gmail_batch_empty_label',
  'gmail_empty_all_labels',
  'gmail_modify_labels',
]);

export async function executeGmailLabelTool(
  toolName: string,
  toolArgs: Record<string, any>,
  ctx: ToolExecutorContext,
  bulkLabelsToVerify: Set<string> | null,
): Promise<GoogleExecutorResult | null> {
  if (!GMAIL_LABEL_TOOLS.has(toolName)) return null;

  try {
    if (!ctx.gmailService) return { response: toolError(toolName, 'Gmail no conectado.'), bulkLabelsToVerify };

    if (toolName === 'gmail_get_labels') {
      return { response: toolResponse(toolName, await ctx.gmailService.getLabels()), bulkLabelsToVerify };
    }
    if (toolName === 'gmail_create_label') {
      return { response: toolResponse(toolName, await ctx.gmailService.createLabel(toolArgs.name)), bulkLabelsToVerify };
    }
    if (toolName === 'gmail_delete_label') {
      return { response: toolResponse(toolName, await ctx.gmailService.deleteLabel(toolArgs.label_id)), bulkLabelsToVerify };
    }
    if (toolName === 'gmail_batch_empty_label') {
      return {
        response: toolResponse(toolName, await ctx.gmailService.batchModifyByLabel(toolArgs.label_id, {
          deleteLabel: toolArgs.delete_label || false,
        })),
        bulkLabelsToVerify,
      };
    }
    if (toolName === 'gmail_empty_all_labels') {
      return { response: toolResponse(toolName, await ctx.gmailService.emptyAndDeleteAllLabels()), bulkLabelsToVerify };
    }

    const result = await ctx.gmailService.modifyLabels(toolArgs.message_id, toolArgs.add_labels, toolArgs.remove_labels);
    if (result.success && toolArgs.remove_labels) {
      bulkLabelsToVerify = trackRemovedUserLabels(toolArgs.remove_labels, bulkLabelsToVerify);
    }

    return { response: toolResponse(toolName, result), bulkLabelsToVerify };
  } catch (err: any) {
    return { response: toolError(toolName, err.message), bulkLabelsToVerify };
  }
}

function trackRemovedUserLabels(labels: string[], current: Set<string> | null): Set<string> {
  const next = current || new Set<string>();
  for (const labelId of labels) {
    if (!SYSTEM_LABELS.has(labelId)) next.add(labelId);
  }
  return next;
}
