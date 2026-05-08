import { toolError, toolResponse } from '../types';
import type { ToolExecutorContext } from '../types';
import type { GoogleExecutorResult } from './types';

const GMAIL_MAIL_TOOLS = new Set(['gmail_send', 'gmail_get_messages', 'gmail_read_message', 'gmail_trash']);

export async function executeGmailMailTool(
  toolName: string,
  toolArgs: Record<string, any>,
  ctx: ToolExecutorContext,
  bulkLabelsToVerify: Set<string> | null,
): Promise<GoogleExecutorResult | null> {
  if (!GMAIL_MAIL_TOOLS.has(toolName)) return null;

  try {
    if (!ctx.gmailService) {
      return { response: toolError(toolName, 'Gmail no esta disponible. El usuario debe conectar Google en SofLIA Hub.'), bulkLabelsToVerify };
    }

    if (toolName === 'gmail_send') {
      const toList = String(toolArgs.to || '').split(',').map((s: string) => s.trim()).filter(Boolean);
      const ccList = toolArgs.cc ? String(toolArgs.cc).split(',').map((s: string) => s.trim()).filter(Boolean) : undefined;
      const result = await ctx.gmailService.sendEmail({
        to: toList,
        subject: toolArgs.subject,
        body: toolArgs.body,
        cc: ccList,
        isHtml: toolArgs.is_html || false,
        attachmentPaths: toolArgs.attachment_paths || undefined,
      });
      return { response: toolResponse(toolName, result), bulkLabelsToVerify };
    }

    if (toolName === 'gmail_get_messages') {
      const result = await ctx.gmailService.getMessages({
        maxResults: Math.min(toolArgs.max_results || 20, 50),
        query: toolArgs.query,
        labelIds: toolArgs.label_ids,
        pageToken: toolArgs.page_token,
      });

      if (!result.success || !result.messages) {
        return { response: toolResponse(toolName, result), bulkLabelsToVerify };
      }

      const formatted = result.messages.map((message: any) => ({
        id: message.id,
        from: message.from,
        subject: message.subject,
        snippet: message.snippet,
        date: message.date,
        isUnread: message.isUnread,
      }));

      return {
        response: toolResponse(toolName, {
          success: true,
          messages: formatted,
          count: formatted.length,
          next_page_token: result.nextPageToken,
          result_size_estimate: result.resultSizeEstimate,
          likely_has_more: !!result.nextPageToken,
          warning: result.nextPageToken
            ? 'Hay mas correos disponibles. Debes volver a llamar gmail_get_messages usando page_token para continuar con el siguiente lote.'
            : undefined,
        }),
        bulkLabelsToVerify,
      };
    }

    const result = toolName === 'gmail_read_message'
      ? await ctx.gmailService.getMessage(toolArgs.message_id)
      : await ctx.gmailService.trashMessage(toolArgs.message_id);
    return { response: toolResponse(toolName, result), bulkLabelsToVerify };
  } catch (err: any) {
    return { response: toolError(toolName, err.message), bulkLabelsToVerify };
  }
}
