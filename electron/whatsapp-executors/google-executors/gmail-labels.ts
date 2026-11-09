import { toolError, toolResponse } from '../types';
import type { ToolExecutorContext } from '../types';
import type { GoogleExecutorResult } from './types';

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
): Promise<GoogleExecutorResult | null> {
  if (!GMAIL_LABEL_TOOLS.has(toolName)) return null;

  try {
    if (!ctx.gmailService) return { response: toolError(toolName, 'Gmail no conectado.') };

    if (toolName === 'gmail_get_labels') {
      return { response: toolResponse(toolName, await ctx.gmailService.getLabels()) };
    }
    if (toolName === 'gmail_create_label') {
      return { response: toolResponse(toolName, await ctx.gmailService.createLabel(toolArgs.name)) };
    }
    if (toolName === 'gmail_delete_label') {
      return { response: toolResponse(toolName, await ctx.gmailService.deleteLabel(toolArgs.label_id)) };
    }
    if (toolName === 'gmail_batch_empty_label') {
      return {
        response: toolResponse(toolName, await ctx.gmailService.batchModifyByLabel(toolArgs.label_id, {
          deleteLabel: toolArgs.delete_label,
        })),
      };
    }
    if (toolName === 'gmail_empty_all_labels') {
      return { response: toolResponse(toolName, await ctx.gmailService.emptyAndDeleteAllLabels()) };
    }

    const result = await ctx.gmailService.modifyLabels(toolArgs.message_id, toolArgs.add_labels, toolArgs.remove_labels);

    return { response: toolResponse(toolName, result) };
  } catch {
    return { response: toolError(toolName, 'No se pudo completar la operación de etiquetas Gmail. Revisa la cuenta y los datos.') };
  }
}
