import {
  createPendingAction,
  getStringList,
} from './custom-action-utils';
import type { WorkflowActionRecord } from '../types';

export function buildGChatMessageAction(title: string, payload: Record<string, any>): WorkflowActionRecord | null {
  const spaceName = String(payload.spaceName || '').trim();
  const text = String(payload.text || '').trim();
  if (!spaceName || !text) return null;
  return createPendingAction('gchat_message', title, { spaceName, text });
}

export function buildGmailReplyAction(title: string, payload: Record<string, any>): WorkflowActionRecord | null {
  const to = getStringList(payload.to);
  const subject = String(payload.subject || '').trim();
  const body = String(payload.body || '').trim();
  if (to.length === 0 || !body) return null;
  return createPendingAction('gmail_reply', title, { to, subject, body });
}

export function buildGmailSendAction(title: string, payload: Record<string, any>): WorkflowActionRecord | null {
  const to = getStringList(payload.to);
  const subject = String(payload.subject || '').trim();
  const body = String(payload.body || '').trim();
  if (to.length === 0 || !subject || !body) return null;
  return createPendingAction('gmail_send', title, { to, subject, body });
}

export function buildCalendarEventAction(title: string, payload: Record<string, any>): WorkflowActionRecord | null {
  const eventTitle = String(payload.title || '').trim();
  const start = String(payload.start || payload.startIso || '').trim();
  const end = String(payload.end || payload.endIso || '').trim();
  if (!eventTitle || !start || !end) return null;
  return createPendingAction('calendar_event', title, {
    title: eventTitle,
    start,
    end,
    description: String(payload.description || '').trim(),
    location: String(payload.location || '').trim(),
  });
}

export function buildGmailLabelsAction(title: string, payload: Record<string, any>): WorkflowActionRecord | null {
  const messageId = String(payload.messageId || '').trim();
  const addLabels = getStringList(payload.addLabels);
  const removeLabels = getStringList(payload.removeLabels);
  if (!messageId || (addLabels.length === 0 && removeLabels.length === 0)) return null;
  return createPendingAction('gmail_labels', title, { messageId, addLabels, removeLabels });
}
