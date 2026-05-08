import crypto from 'node:crypto';
import { CALENDAR_BRIEF_SCHEMA } from '../schemas';
import type { ExecuteTemplateInput, WorkflowActionRecord, WorkflowRunRecord } from '../types';
import { formatDateOnly, parseTargetDate } from '../helpers';
import type { WorkspaceTemplateHandlerContext } from './types';

export async function executeCalendarDailyBrief(
  payload: ExecuteTemplateInput,
  context: WorkspaceTemplateHandlerContext,
): Promise<WorkflowRunRecord> {
  const targetDate = parseTargetDate(payload.input?.targetDate);
  const gchatSpace = typeof payload.input?.gchatSpace === 'string' ? payload.input.gchatSpace.trim() : '';
  const events = await context.deps.calendarService.getCurrentEvents(targetDate);

  const briefing = await context.llmTaskService.runJsonTask<{
    summary: string;
    keyPoints: string[];
    risks: string[];
    shouldSendChat: boolean;
    confidence: number;
    chatDraft?: string;
  }>({
    prompt: [
      'Genera un briefing ejecutivo de agenda diaria.',
      'Resume prioridades del dia, riesgos de calendario y si conviene notificarlo al equipo.',
      'Si shouldSendChat es true y existe gchatSpace, devuelve chatDraft listo para publicarse.',
      'No inventes eventos ni participantes.',
    ].join('\n'),
    input: {
      targetDate: formatDateOnly(targetDate),
      eventCount: events.length,
      events: events.map((event) => ({
        title: event.title,
        start: event.start.toISOString(),
        end: event.end.toISOString(),
        isAllDay: event.isAllDay,
        location: event.location || null,
        description: event.description || null,
        source: event.source,
      })),
      options: { gchatSpace: gchatSpace || null },
    },
    schema: CALENDAR_BRIEF_SCHEMA,
  });

  const actions: WorkflowActionRecord[] = [];
  if (briefing.output.shouldSendChat && briefing.output.chatDraft?.trim() && gchatSpace) {
    actions.push({
      id: crypto.randomUUID(),
      kind: 'gchat_message',
      title: 'Publicar briefing diario en Google Chat',
      status: 'pending',
      payload: {
        spaceName: gchatSpace,
        text: briefing.output.chatDraft.trim(),
      },
    });
  }

  return context.createRun({
    templateId: 'calendar_daily_brief',
    title: `Briefing de calendario ${formatDateOnly(targetDate)}`,
    requestedBy: payload.requestedBy || null,
    input: { targetDate: formatDateOnly(targetDate), gchatSpace: gchatSpace || null },
    source: { eventCount: events.length },
    preview: {
      summary: briefing.output.summary,
      keyPoints: briefing.output.keyPoints,
      risks: briefing.output.risks,
      confidence: briefing.output.confidence,
      chatDraft: briefing.output.chatDraft || null,
    },
    actions,
    status: actions.length > 0 ? 'needs_approval' : 'completed',
    initialLog: `Se genero un briefing con ${events.length} evento(s) para ${formatDateOnly(targetDate)}.`,
  });
}
