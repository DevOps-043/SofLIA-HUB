import crypto from 'node:crypto';
import { GCHAT_EXECUTIVE_UPDATE_SCHEMA } from '../schemas';
import type { ExecuteTemplateInput, WorkflowActionRecord, WorkflowRunRecord } from '../types';
import type { WorkspaceTemplateHandlerContext } from './types';

export async function executeGChatExecutiveUpdate(
  payload: ExecuteTemplateInput,
  context: WorkspaceTemplateHandlerContext,
): Promise<WorkflowRunRecord> {
  const spaceName = String(payload.input?.spaceName || '').trim();
  const updateContext = String(payload.input?.context || '').trim();
  const tone = String(payload.input?.tone || 'ejecutivo y claro').trim();

  if (!spaceName) {
    throw new Error('Necesito el espacio de Google Chat para preparar la actualizacion.');
  }
  if (!updateContext) {
    throw new Error('Necesito el contexto de la actualizacion ejecutiva.');
  }

  const update = await context.llmTaskService.runJsonTask<{
    summary: string;
    message: string;
    confidence: number;
  }>({
    prompt: [
      'Redacta una actualizacion ejecutiva breve para Google Chat.',
      'Debe ser clara, concreta y apta para directivos.',
      'No inventes avances ni cifras que no existan en el contexto.',
    ].join('\n'),
    input: {
      spaceName,
      context: updateContext,
      tone,
    },
    schema: GCHAT_EXECUTIVE_UPDATE_SCHEMA,
  });

  const actions: WorkflowActionRecord[] = [{
    id: crypto.randomUUID(),
    kind: 'gchat_message',
    title: 'Enviar actualizacion ejecutiva por Google Chat',
    status: 'pending',
    payload: {
      spaceName,
      text: update.output.message.trim(),
    },
  }];

  return context.createRun({
    templateId: 'gchat_executive_update',
    title: `Actualizacion ejecutiva: ${spaceName}`,
    requestedBy: payload.requestedBy || null,
    input: { spaceName, context: updateContext, tone },
    source: null,
    preview: {
      summary: update.output.summary,
      confidence: update.output.confidence,
      message: update.output.message,
    },
    actions,
    status: 'needs_approval',
    initialLog: `Se preparo una actualizacion ejecutiva para ${spaceName}.`,
  });
}
