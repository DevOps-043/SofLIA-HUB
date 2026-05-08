import crypto from 'node:crypto';
import type { EmailMessage } from '../../../gmail-service';
import {
  buildReplySubject,
  extractPrimaryEmailAddress,
} from '../../helpers';
import type { WorkflowActionRecord } from '../../types';
import type { GmailTriageOutput } from './types';

export function buildGmailTriageActions(
  message: EmailMessage,
  triage: GmailTriageOutput,
  options: { gchatSpace: string; removeFromInbox: boolean },
): WorkflowActionRecord[] {
  const actions: WorkflowActionRecord[] = [];
  const labelsToAdd = getLabelsToAdd(triage);
  const removeLabels = triage.archive && options.removeFromInbox ? ['INBOX'] : [];

  if (labelsToAdd.length > 0 || removeLabels.length > 0) {
    actions.push({
      id: crypto.randomUUID(),
      kind: 'gmail_labels',
      title: 'Aplicar etiquetas en Gmail',
      status: 'pending',
      payload: { messageId: message.id, addLabels: labelsToAdd, removeLabels },
    });
  }

  appendReplyAction(actions, message, triage);
  appendCalendarAction(actions, triage);
  appendChatAction(actions, triage, options.gchatSpace);
  return actions;
}

function getLabelsToAdd(triage: GmailTriageOutput): string[] {
  return Array.isArray(triage.labelsToAdd)
    ? triage.labelsToAdd.map((item) => String(item || '').trim()).filter(Boolean)
    : [];
}

function appendReplyAction(actions: WorkflowActionRecord[], message: EmailMessage, triage: GmailTriageOutput) {
  if (!triage.reply?.body?.trim()) return;

  const primaryRecipient = extractPrimaryEmailAddress(message.from);
  if (!primaryRecipient) return;

  actions.push({
    id: crypto.randomUUID(),
    kind: 'gmail_reply',
    title: 'Enviar respuesta por Gmail',
    status: 'pending',
    payload: {
      to: [primaryRecipient],
      subject: triage.reply.subject?.trim() || buildReplySubject(message.subject),
      body: triage.reply.body.trim(),
    },
  });
}

function appendCalendarAction(actions: WorkflowActionRecord[], triage: GmailTriageOutput) {
  if (!triage.calendarEvent?.title?.trim() || !triage.calendarEvent.startIso || !triage.calendarEvent.endIso) return;

  actions.push({
    id: crypto.randomUUID(),
    kind: 'calendar_event',
    title: 'Crear evento en Google Calendar',
    status: 'pending',
    payload: {
      title: triage.calendarEvent.title.trim(),
      start: triage.calendarEvent.startIso,
      end: triage.calendarEvent.endIso,
      description: triage.calendarEvent.description?.trim() || '',
      location: triage.calendarEvent.location?.trim() || '',
    },
  });
}

function appendChatAction(actions: WorkflowActionRecord[], triage: GmailTriageOutput, gchatSpace: string) {
  if (!triage.chatNotification?.text?.trim() || !gchatSpace) return;

  actions.push({
    id: crypto.randomUUID(),
    kind: 'gchat_message',
    title: 'Enviar alerta a Google Chat',
    status: 'pending',
    payload: {
      spaceName: gchatSpace,
      text: triage.chatNotification.text.trim(),
    },
  });
}
