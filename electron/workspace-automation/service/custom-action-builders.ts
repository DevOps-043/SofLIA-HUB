import {
  buildCalendarEventAction,
  buildGChatMessageAction,
  buildGmailLabelsAction,
  buildGmailReplyAction,
  buildGmailSendAction,
} from './custom-action-google-builders';
import {
  buildDesktopTaskAction,
  buildDriveFolderTreeAction,
} from './custom-action-workspace-builders';
import {
  getActionTitle,
  getPayloadObject,
  type GeneratedCustomAction,
} from './custom-action-utils';
import type { WorkflowActionRecord } from '../types';

export function buildCustomAction(action: GeneratedCustomAction): WorkflowActionRecord | null {
  const title = getActionTitle(action);
  const payload = getPayloadObject(action);

  switch (action.kind) {
    case 'desktop_task':
      return buildDesktopTaskAction(title, payload);
    case 'gchat_message':
      return buildGChatMessageAction(title, payload);
    case 'gmail_reply':
      return buildGmailReplyAction(title, payload);
    case 'gmail_send':
      return buildGmailSendAction(title, payload);
    case 'calendar_event':
      return buildCalendarEventAction(title, payload);
    case 'gmail_labels':
      return buildGmailLabelsAction(title, payload);
    case 'drive_folder_tree':
      return buildDriveFolderTreeAction(title, payload);
    default:
      return null;
  }
}
