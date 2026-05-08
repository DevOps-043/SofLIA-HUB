import crypto from 'node:crypto';
import type { EmailMessage } from '../../gmail-service';
import { GMAIL_TRIAGE_SCHEMA } from '../schemas';
import type { ExecuteTemplateInput, WorkflowActionRecord, WorkflowRunRecord } from '../types';
import {
  buildReplySubject,
  extractPrimaryEmailAddress,
  pickBestMessage,
} from '../helpers';
import type { WorkspaceTemplateHandlerContext } from './types';

type GmailTriageDecision = 'reply' | 'label_only' | 'schedule' | 'notify_chat' | 'ignore';

interface GmailTriageOutput {
  decision: GmailTriageDecision;
  summary: string;
  rationale: string;
  labelsToAdd: string[];
  archive: boolean;
  confidence: number;
  reply?: { subject: string; body: string };
  calendarEvent?: { title: string; startIso: string; endIso: string; description: string; location?: string };
  chatNotification?: { text: string };
}

export async function executeGmailTriage(
  payload: ExecuteTemplateInput,
  context: WorkspaceTemplateHandlerContext,
): Promise<WorkflowRunRecord> {
  const query = String(payload.input?.query || 'in:inbox newer_than:7d').trim();
  const maxResults = Math.min(Math.max(Number(payload.input?.maxResults) || 5, 1), 10);
  const removeFromInbox = payload.input?.removeFromInbox !== false;
  const gchatSpace = typeof payload.input?.gchatSpace === 'string' ? payload.input.gchatSpace.trim() : '';

  const messagesResult = await context.deps.gmailService.getMessages({ query, maxResults });
  if (!messagesResult.success || !messagesResult.messages?.length) {
    throw new Error(messagesResult.error || 'No encontre correos para el triage.');
  }

  const targetMessage = pickBestMessage(messagesResult.messages);
  const messageDetailResult = await context.deps.gmailService.getMessage(targetMessage.id);
  if (!messageDetailResult.success || !messageDetailResult.message) {
    throw new Error(messageDetailResult.error || 'No pude leer el correo seleccionado.');
  }

  const detail = messageDetailResult.message;
  const triage = await context.llmTaskService.runJsonTask<GmailTriageOutput>({
    prompt: [
      'Analiza este correo y propone una accion operativa.',
      'Usa solo una decision principal: reply, label_only, schedule, notify_chat o ignore.',
      'Si propones schedule, debes devolver calendarEvent con fechas ISO completas.',
      'Si propones reply, debes devolver reply con subject y body listos para enviar.',
      'Si propones notify_chat y existe gchatSpace, devuelve chatNotification.text.',
      'Puedes agregar labelsToAdd siempre que ayuden a clasificar.',
      'archive debe ser true solo si el correo ya quedara gestionado despues de ejecutar la accion propuesta.',
      'Responde en espanol profesional y concreto.',
    ].join('\n'),
    input: {
      email: {
        id: detail.id,
        threadId: detail.threadId,
        from: detail.from,
        subject: detail.subject,
        snippet: detail.snippet,
        body: detail.body || '',
        date: detail.date.toISOString(),
        labelIds: detail.labelIds,
        isUnread: detail.isUnread,
      },
      options: {
        gchatSpace: gchatSpace || null,
        removeFromInbox,
      },
    },
    schema: GMAIL_TRIAGE_SCHEMA,
  });

  const actions = buildGmailTriageActions(detail, triage.output, { gchatSpace, removeFromInbox });

  return context.createRun({
    templateId: 'gmail_triage',
    title: `Triage Gmail: ${detail.subject || 'Sin asunto'}`,
    requestedBy: payload.requestedBy || null,
    input: { query, maxResults, gchatSpace: gchatSpace || null, removeFromInbox },
    source: {
      messageId: detail.id,
      threadId: detail.threadId,
      from: detail.from,
      subject: detail.subject,
      date: detail.date.toISOString(),
    },
    preview: {
      summary: triage.output.summary,
      rationale: triage.output.rationale,
      confidence: triage.output.confidence,
      decision: triage.output.decision,
      reply: triage.output.reply || null,
      calendarEvent: triage.output.calendarEvent || null,
      chatNotification: triage.output.chatNotification || null,
      labelsToAdd: triage.output.labelsToAdd || [],
      archive: Boolean(triage.output.archive),
    },
    actions,
    status: actions.length > 0 ? 'needs_approval' : 'completed',
    initialLog: `Correo analizado: ${detail.subject || 'Sin asunto'} (${detail.from}).`,
  });
}

function buildGmailTriageActions(
  message: EmailMessage,
  triage: GmailTriageOutput,
  options: { gchatSpace: string; removeFromInbox: boolean },
): WorkflowActionRecord[] {
  const actions: WorkflowActionRecord[] = [];
  const labelsToAdd = Array.isArray(triage.labelsToAdd)
    ? triage.labelsToAdd.map((item) => String(item || '').trim()).filter(Boolean)
    : [];
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

  if (triage.reply?.body?.trim()) {
    const primaryRecipient = extractPrimaryEmailAddress(message.from);
    if (primaryRecipient) {
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
  }

  if (triage.calendarEvent?.title?.trim() && triage.calendarEvent.startIso && triage.calendarEvent.endIso) {
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

  if (triage.chatNotification?.text?.trim() && options.gchatSpace) {
    actions.push({
      id: crypto.randomUUID(),
      kind: 'gchat_message',
      title: 'Enviar alerta a Google Chat',
      status: 'pending',
      payload: {
        spaceName: options.gchatSpace,
        text: triage.chatNotification.text.trim(),
      },
    });
  }

  return actions;
}
