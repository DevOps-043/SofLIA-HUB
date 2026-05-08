import type { WorkspaceAutomationService } from '../../workspace-automation-service.ts';
import {
  executeCalendarEventAction,
  executeGChatMessageAction,
  executeGmailLabelsAction,
  executeGmailSendLikeAction,
} from './execute-google-action';
import {
  executeDesktopTaskAction,
  executeDriveFolderTreeAction,
} from './execute-workspace-action';
import type { WorkflowActionRecord } from '../types';

export async function executeAction(
  this: WorkspaceAutomationService,
  action: WorkflowActionRecord,
): Promise<Record<string, any>> {
  switch (action.kind) {
    case 'gmail_labels':
      return executeGmailLabelsAction(this.deps, action);
    case 'gmail_reply':
      return executeGmailSendLikeAction(this.deps, action, 'No se pudo enviar la respuesta de Gmail.');
    case 'gmail_send':
      return executeGmailSendLikeAction(this.deps, action, 'No se pudo enviar el correo de Gmail.');
    case 'calendar_event':
      return executeCalendarEventAction(this.deps, action);
    case 'gchat_message':
      return executeGChatMessageAction(this.deps, action);
    case 'drive_folder_tree':
      return executeDriveFolderTreeAction(this.deps, action);
    case 'desktop_task':
      return executeDesktopTaskAction(this.deps, action);
    default:
      throw new Error(`Accion no soportada: ${action.kind}`);
  }
}
