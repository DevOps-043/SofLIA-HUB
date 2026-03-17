/**
 * Google Workspace tool executors for the WhatsApp agent.
 */
import { app } from 'electron';
import path from 'node:path';
import type { ToolExecutorContext, FunctionResponse } from './types';
import { toolResponse, toolError } from './types';

const GOOGLE_TOOLS = new Set([
  'google_calendar_create',
  'google_calendar_get_events',
  'google_calendar_delete',
  'gmail_send',
  'gmail_get_messages',
  'gmail_read_message',
  'gmail_trash',
  'gmail_get_labels',
  'gmail_create_label',
  'gmail_preview_organization',
  'gmail_apply_organization_plan',
  'gmail_undo_organization_plan',
  'gmail_delete_label',
  'gmail_batch_empty_label',
  'gmail_empty_all_labels',
  'gmail_modify_labels',
  'drive_list_files',
  'drive_search',
  'drive_download',
  'drive_upload',
  'drive_create_folder',
  'gchat_list_spaces',
  'gchat_get_messages',
  'gchat_send_message',
  'gchat_add_reaction',
  'gchat_get_members',
]);

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

  if (toolName === 'google_calendar_create') {
    try {
      if (!ctx.calendarService) {
        return { response: toolError(toolName, 'Google Calendar no esta disponible. El usuario debe conectar Google en SofLIA Hub.'), bulkLabelsToVerify };
      }

      const startDate = new Date(toolArgs.start_date);
      const endDate = toolArgs.end_date ? new Date(toolArgs.end_date) : new Date(startDate.getTime() + 60 * 60 * 1000);
      const result = await ctx.calendarService.createEvent({
        title: toolArgs.title,
        start: startDate,
        end: endDate,
        description: toolArgs.description,
        location: toolArgs.location,
      });

      if (result.success) {
        const dayNames = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
        const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
        const timeStr = `${startDate.getHours().toString().padStart(2, '0')}:${startDate.getMinutes().toString().padStart(2, '0')}`;
        return {
          response: toolResponse(toolName, {
            success: true,
            eventId: result.eventId,
            message: `Evento creado en Google Calendar: "${toolArgs.title}" el ${dayNames[startDate.getDay()]} ${startDate.getDate()} de ${monthNames[startDate.getMonth()]} a las ${timeStr}`,
          }),
          bulkLabelsToVerify,
        };
      }

      return { response: toolResponse(toolName, result), bulkLabelsToVerify };
    } catch (err: any) {
      return { response: toolError(toolName, err.message), bulkLabelsToVerify };
    }
  }

  if (toolName === 'google_calendar_get_events') {
    try {
      if (!ctx.calendarService) return { response: toolError(toolName, 'Google Calendar no conectado.'), bulkLabelsToVerify };

      let start = new Date();
      start.setHours(0, 0, 0, 0);
      let end = new Date(start);
      end.setHours(23, 59, 59, 999);

      if (toolArgs.start_date) {
        start = new Date(toolArgs.start_date);
        end = new Date(start);
        end.setHours(23, 59, 59, 999);
      }
      if (toolArgs.end_date) {
        end = new Date(toolArgs.end_date);
      }

      const events = await ctx.calendarService.getCurrentEvents(start);
      const formatted = events.map((event: any) => ({
        id: event.id,
        title: event.title,
        start: event.isAllDay ? event.start.toISOString().split('T')[0] : event.start.toLocaleString('es-MX'),
        end: event.isAllDay ? event.end.toISOString().split('T')[0] : event.end.toLocaleString('es-MX'),
        location: event.location || null,
        description: event.description || null,
        isAllDay: event.isAllDay,
      }));

      return {
        response: toolResponse(toolName, {
          success: true,
          request_range: { start: start.toLocaleString('es-MX'), end: end.toLocaleString('es-MX') },
          events: formatted,
          count: formatted.length,
        }),
        bulkLabelsToVerify,
      };
    } catch (err: any) {
      return { response: toolError(toolName, err.message), bulkLabelsToVerify };
    }
  }

  if (toolName === 'google_calendar_delete') {
    try {
      if (!ctx.calendarService) return { response: toolError(toolName, 'Google Calendar no conectado.'), bulkLabelsToVerify };
      return { response: toolResponse(toolName, await ctx.calendarService.deleteEvent(toolArgs.event_id)), bulkLabelsToVerify };
    } catch (err: any) {
      return { response: toolError(toolName, err.message), bulkLabelsToVerify };
    }
  }

  if (toolName === 'gmail_send') {
    try {
      if (!ctx.gmailService) {
        return { response: toolError(toolName, 'Gmail no esta disponible. El usuario debe conectar Google en SofLIA Hub.'), bulkLabelsToVerify };
      }

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
    } catch (err: any) {
      return { response: toolError(toolName, err.message), bulkLabelsToVerify };
    }
  }

  if (toolName === 'gmail_get_messages') {
    try {
      if (!ctx.gmailService) return { response: toolError(toolName, 'Gmail no conectado.'), bulkLabelsToVerify };

      const result = await ctx.gmailService.getMessages({
        maxResults: Math.min(toolArgs.max_results || 20, 50),
        query: toolArgs.query,
        labelIds: toolArgs.label_ids,
        pageToken: toolArgs.page_token,
      });

      if (result.success && result.messages) {
        const formatted = result.messages.map(message => ({
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

      return { response: toolResponse(toolName, result), bulkLabelsToVerify };
    } catch (err: any) {
      return { response: toolError(toolName, err.message), bulkLabelsToVerify };
    }
  }

  if (toolName === 'gmail_read_message') {
    try {
      if (!ctx.gmailService) return { response: toolError(toolName, 'Gmail no conectado.'), bulkLabelsToVerify };
      return { response: toolResponse(toolName, await ctx.gmailService.getMessage(toolArgs.message_id)), bulkLabelsToVerify };
    } catch (err: any) {
      return { response: toolError(toolName, err.message), bulkLabelsToVerify };
    }
  }

  if (toolName === 'gmail_trash') {
    try {
      if (!ctx.gmailService) return { response: toolError(toolName, 'Gmail no conectado.'), bulkLabelsToVerify };
      return { response: toolResponse(toolName, await ctx.gmailService.trashMessage(toolArgs.message_id)), bulkLabelsToVerify };
    } catch (err: any) {
      return { response: toolError(toolName, err.message), bulkLabelsToVerify };
    }
  }

  if (toolName === 'gmail_get_labels') {
    try {
      if (!ctx.gmailService) return { response: toolError(toolName, 'Gmail no conectado.'), bulkLabelsToVerify };
      return { response: toolResponse(toolName, await ctx.gmailService.getLabels()), bulkLabelsToVerify };
    } catch (err: any) {
      return { response: toolError(toolName, err.message), bulkLabelsToVerify };
    }
  }

  if (toolName === 'gmail_create_label') {
    try {
      if (!ctx.gmailService) return { response: toolError(toolName, 'Gmail no conectado.'), bulkLabelsToVerify };
      return { response: toolResponse(toolName, await ctx.gmailService.createLabel(toolArgs.name)), bulkLabelsToVerify };
    } catch (err: any) {
      return { response: toolError(toolName, err.message), bulkLabelsToVerify };
    }
  }

  if (toolName === 'gmail_preview_organization') {
    try {
      if (!ctx.gmailService) return { response: toolError(toolName, 'Gmail no conectado.'), bulkLabelsToVerify };
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
    } catch (err: any) {
      return { response: toolError(toolName, err.message), bulkLabelsToVerify };
    }
  }

  if (toolName === 'gmail_apply_organization_plan') {
    try {
      if (!ctx.gmailService) return { response: toolError(toolName, 'Gmail no conectado.'), bulkLabelsToVerify };
      return {
        response: toolResponse(toolName, await ctx.gmailService.applyOrganizationPlan(toolArgs.plan_id, {
          removeFromInbox: toolArgs.remove_from_inbox,
        })),
        bulkLabelsToVerify,
      };
    } catch (err: any) {
      return { response: toolError(toolName, err.message), bulkLabelsToVerify };
    }
  }

  if (toolName === 'gmail_undo_organization_plan') {
    try {
      if (!ctx.gmailService) return { response: toolError(toolName, 'Gmail no conectado.'), bulkLabelsToVerify };
      return {
        response: toolResponse(toolName, await ctx.gmailService.undoOrganizationPlan(toolArgs.plan_id)),
        bulkLabelsToVerify,
      };
    } catch (err: any) {
      return { response: toolError(toolName, err.message), bulkLabelsToVerify };
    }
  }

  if (toolName === 'gmail_delete_label') {
    try {
      if (!ctx.gmailService) return { response: toolError(toolName, 'Gmail no conectado.'), bulkLabelsToVerify };
      return { response: toolResponse(toolName, await ctx.gmailService.deleteLabel(toolArgs.label_id)), bulkLabelsToVerify };
    } catch (err: any) {
      return { response: toolError(toolName, err.message), bulkLabelsToVerify };
    }
  }

  if (toolName === 'gmail_batch_empty_label') {
    try {
      if (!ctx.gmailService) return { response: toolError(toolName, 'Gmail no conectado.'), bulkLabelsToVerify };
      return {
        response: toolResponse(toolName, await ctx.gmailService.batchModifyByLabel(toolArgs.label_id, { deleteLabel: toolArgs.delete_label || false })),
        bulkLabelsToVerify,
      };
    } catch (err: any) {
      return { response: toolError(toolName, err.message), bulkLabelsToVerify };
    }
  }

  if (toolName === 'gmail_empty_all_labels') {
    try {
      if (!ctx.gmailService) return { response: toolError(toolName, 'Gmail no conectado.'), bulkLabelsToVerify };
      return { response: toolResponse(toolName, await ctx.gmailService.emptyAndDeleteAllLabels()), bulkLabelsToVerify };
    } catch (err: any) {
      return { response: toolError(toolName, err.message), bulkLabelsToVerify };
    }
  }

  if (toolName === 'gmail_modify_labels') {
    try {
      if (!ctx.gmailService) return { response: toolError(toolName, 'Gmail no conectado.'), bulkLabelsToVerify };

      const result = await ctx.gmailService.modifyLabels(toolArgs.message_id, toolArgs.add_labels, toolArgs.remove_labels);
      if (result.success && toolArgs.remove_labels) {
        for (const labelId of toolArgs.remove_labels) {
          if (!['INBOX', 'UNREAD', 'SPAM', 'TRASH', 'SENT', 'DRAFT'].includes(labelId)) {
            if (!bulkLabelsToVerify) bulkLabelsToVerify = new Set<string>();
            bulkLabelsToVerify.add(labelId);
          }
        }
      }

      return { response: toolResponse(toolName, result), bulkLabelsToVerify };
    } catch (err: any) {
      return { response: toolError(toolName, err.message), bulkLabelsToVerify };
    }
  }

  if (toolName === 'drive_list_files') {
    try {
      if (!ctx.driveService) return { response: toolError(toolName, 'Google Drive no conectado.'), bulkLabelsToVerify };
      return { response: toolResponse(toolName, await ctx.driveService.listFiles({ folderId: toolArgs.folder_id, maxResults: toolArgs.max_results || 20 })), bulkLabelsToVerify };
    } catch (err: any) {
      return { response: toolError(toolName, err.message), bulkLabelsToVerify };
    }
  }

  if (toolName === 'drive_search') {
    try {
      if (!ctx.driveService) return { response: toolError(toolName, 'Google Drive no conectado.'), bulkLabelsToVerify };
      return { response: toolResponse(toolName, await ctx.driveService.searchFiles(toolArgs.query)), bulkLabelsToVerify };
    } catch (err: any) {
      return { response: toolError(toolName, err.message), bulkLabelsToVerify };
    }
  }

  if (toolName === 'drive_download') {
    try {
      if (!ctx.driveService) return { response: toolError(toolName, 'Google Drive no conectado.'), bulkLabelsToVerify };
      const tmpDir = app.getPath('temp');
      const fallbackName = toolArgs.file_name || `drive_${toolArgs.file_id}`;
      const destinationPath = toolArgs.destination_path || path.join(tmpDir, fallbackName);
      const format = toolArgs.format === 'pdf' ? 'pdf' as const : 'text' as const;
      const result = await ctx.driveService.downloadFile(toolArgs.file_id, destinationPath, format);
      return { response: toolResponse(toolName, { ...result, localPath: result.path || destinationPath }), bulkLabelsToVerify };
    } catch (err: any) {
      return { response: toolError(toolName, err.message), bulkLabelsToVerify };
    }
  }

  if (toolName === 'drive_upload') {
    try {
      if (!ctx.driveService) return { response: toolError(toolName, 'Google Drive no conectado.'), bulkLabelsToVerify };
      return {
        response: toolResponse(toolName, await ctx.driveService.uploadFile(toolArgs.file_path, { name: toolArgs.name, folderId: toolArgs.folder_id })),
        bulkLabelsToVerify,
      };
    } catch (err: any) {
      return { response: toolError(toolName, err.message), bulkLabelsToVerify };
    }
  }

  if (toolName === 'drive_create_folder') {
    try {
      if (!ctx.driveService) return { response: toolError(toolName, 'Google Drive no conectado.'), bulkLabelsToVerify };
      return { response: toolResponse(toolName, await ctx.driveService.createFolder(toolArgs.name, toolArgs.parent_id)), bulkLabelsToVerify };
    } catch (err: any) {
      return { response: toolError(toolName, err.message), bulkLabelsToVerify };
    }
  }

  if (toolName === 'gchat_list_spaces') {
    try {
      if (!ctx.gchatService) return { response: toolError(toolName, 'Google Chat no conectado. El usuario debe conectar Google en SofLIA Hub.'), bulkLabelsToVerify };
      return { response: toolResponse(toolName, await ctx.gchatService.listSpaces()), bulkLabelsToVerify };
    } catch (err: any) {
      return { response: toolError(toolName, err.message), bulkLabelsToVerify };
    }
  }

  if (toolName === 'gchat_get_messages') {
    try {
      if (!ctx.gchatService) return { response: toolError(toolName, 'Google Chat no conectado.'), bulkLabelsToVerify };
      return { response: toolResponse(toolName, await ctx.gchatService.getMessages(toolArgs.space_name, toolArgs.max_results)), bulkLabelsToVerify };
    } catch (err: any) {
      return { response: toolError(toolName, err.message), bulkLabelsToVerify };
    }
  }

  if (toolName === 'gchat_send_message') {
    try {
      if (!ctx.gchatService) return { response: toolError(toolName, 'Google Chat no conectado.'), bulkLabelsToVerify };
      return { response: toolResponse(toolName, await ctx.gchatService.sendMessage(toolArgs.space_name, toolArgs.text, toolArgs.thread_name)), bulkLabelsToVerify };
    } catch (err: any) {
      return { response: toolError(toolName, err.message), bulkLabelsToVerify };
    }
  }

  if (toolName === 'gchat_add_reaction') {
    try {
      if (!ctx.gchatService) return { response: toolError(toolName, 'Google Chat no conectado.'), bulkLabelsToVerify };
      return { response: toolResponse(toolName, await ctx.gchatService.addReaction(toolArgs.message_name, toolArgs.emoji)), bulkLabelsToVerify };
    } catch (err: any) {
      return { response: toolError(toolName, err.message), bulkLabelsToVerify };
    }
  }

  if (toolName === 'gchat_get_members') {
    try {
      if (!ctx.gchatService) return { response: toolError(toolName, 'Google Chat no conectado.'), bulkLabelsToVerify };
      return { response: toolResponse(toolName, await ctx.gchatService.getMembers(toolArgs.space_name)), bulkLabelsToVerify };
    } catch (err: any) {
      return { response: toolError(toolName, err.message), bulkLabelsToVerify };
    }
  }

  return null;
}
