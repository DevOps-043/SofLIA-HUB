import crypto from 'node:crypto';
import { CALENDAR_MEETING_PREP_SCHEMA } from '../schemas';
import type { ExecuteTemplateInput, WorkflowActionRecord, WorkflowRunRecord } from '../types';
import { formatDateOnly, parseTargetDate, pickMeetingEvent } from '../helpers';
import type { WorkspaceTemplateHandlerContext } from './types';

export async function executeCalendarMeetingPrep(
  payload: ExecuteTemplateInput,
  context: WorkspaceTemplateHandlerContext,
): Promise<WorkflowRunRecord> {
  const targetDate = parseTargetDate(payload.input?.targetDate);
  const gchatSpace = typeof payload.input?.gchatSpace === 'string' ? payload.input.gchatSpace.trim() : '';
  const events = await context.deps.calendarService.getCurrentEvents(targetDate);
  const event = pickMeetingEvent(events, targetDate);
  if (!event) {
    throw new Error('No encontre una reunion para preparar en la fecha indicada.');
  }

  const prep = await context.llmTaskService.runJsonTask<{
    summary: string;
    talkingPoints: string[];
    risks: string[];
    shouldSendChat: boolean;
    chatDraft?: string;
    confidence: number;
  }>({
    prompt: [
      'Prepara una ficha ejecutiva para la siguiente reunion del calendario.',
      'Resume objetivo probable, talking points y riesgos o huecos de informacion.',
      'No inventes asistentes ni acuerdos.',
      'Si existe gchatSpace y vale la pena compartir el prep con el equipo, activa shouldSendChat y devuelve chatDraft.',
    ].join('\n'),
    input: {
      targetDate: formatDateOnly(targetDate),
      event: {
        title: event.title,
        start: event.start.toISOString(),
        end: event.end.toISOString(),
        location: event.location || null,
        description: event.description || null,
        isAllDay: event.isAllDay,
        source: event.source,
      },
      options: { gchatSpace: gchatSpace || null },
    },
    schema: CALENDAR_MEETING_PREP_SCHEMA,
  });

  const actions: WorkflowActionRecord[] = [];
  if (prep.output.shouldSendChat && prep.output.chatDraft?.trim() && gchatSpace) {
    actions.push({
      id: crypto.randomUUID(),
      kind: 'gchat_message',
      title: 'Compartir preparacion de reunion en Google Chat',
      status: 'pending',
      payload: {
        spaceName: gchatSpace,
        text: prep.output.chatDraft.trim(),
      },
    });
  }

  return context.createRun({
    templateId: 'calendar_meeting_prep',
    title: `Preparacion de reunion: ${event.title || 'Sin titulo'}`,
    requestedBy: payload.requestedBy || null,
    input: { targetDate: formatDateOnly(targetDate), gchatSpace: gchatSpace || null },
    source: {
      eventId: event.id,
      title: event.title,
      start: event.start.toISOString(),
      end: event.end.toISOString(),
      location: event.location || null,
    },
    preview: {
      summary: prep.output.summary,
      talkingPoints: prep.output.talkingPoints,
      risks: prep.output.risks,
      confidence: prep.output.confidence,
      chatDraft: prep.output.chatDraft || null,
    },
    actions,
    status: actions.length > 0 ? 'needs_approval' : 'completed',
    initialLog: `Se preparo la reunion ${event.title || 'sin titulo'} del ${formatDateOnly(targetDate)}.`,
  });
}
