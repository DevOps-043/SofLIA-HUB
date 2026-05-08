import { GMAIL_TRIAGE_SCHEMA } from '../schemas';
import type { ExecuteTemplateInput, WorkflowRunRecord } from '../types';
import { pickBestMessage } from '../helpers';
import { buildGmailTriageActions } from './gmail-triage/actions';
import { GMAIL_TRIAGE_PROMPT } from './gmail-triage/prompt';
import type { GmailTriageOutput } from './gmail-triage/types';
import type { WorkspaceTemplateHandlerContext } from './types';

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
    prompt: GMAIL_TRIAGE_PROMPT,
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
