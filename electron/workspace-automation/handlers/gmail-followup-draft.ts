import crypto from 'node:crypto';
import { GMAIL_FOLLOWUP_SCHEMA } from '../schemas';
import type { ExecuteTemplateInput, WorkflowActionRecord, WorkflowRunRecord } from '../types';
import type { WorkspaceTemplateHandlerContext } from './types';

export async function executeGmailFollowupDraft(
  payload: ExecuteTemplateInput,
  context: WorkspaceTemplateHandlerContext,
): Promise<WorkflowRunRecord> {
  const to = String(payload.input?.to || '').trim();
  const topic = String(payload.input?.topic || '').trim();
  const bodyContext = String(payload.input?.context || '').trim();
  const tone = String(payload.input?.tone || 'profesional y claro').trim();
  const signature = String(payload.input?.signature || '').trim();

  if (!to) {
    throw new Error('Necesito el correo destino para preparar el seguimiento.');
  }
  if (!topic) {
    throw new Error('Necesito el tema o motivo del seguimiento.');
  }

  const followup = await context.llmTaskService.runJsonTask<{
    summary: string;
    subject: string;
    body: string;
    confidence: number;
  }>({
    prompt: [
      'Redacta un correo de seguimiento ejecutivo y claro.',
      'Debe sonar profesional, humano y accionable.',
      'No inventes acuerdos, cifras ni fechas que no aparezcan en el contexto.',
      'Asume que se enviara desde Gmail y devuelve asunto y cuerpo listos para enviar.',
      'Respeta el tono solicitado si existe.',
      'Si se proporciona una firma, integrala al final del correo sin inventar cargo ni datos nuevos.',
    ].join('\n'),
    input: {
      to,
      topic,
      context: bodyContext || null,
      tone: tone || null,
      signature: signature || null,
    },
    schema: GMAIL_FOLLOWUP_SCHEMA,
  });

  const actions: WorkflowActionRecord[] = [{
    id: crypto.randomUUID(),
    kind: 'gmail_send',
    title: 'Enviar correo de seguimiento',
    status: 'pending',
    payload: {
      to: [to],
      subject: followup.output.subject.trim(),
      body: followup.output.body.trim(),
    },
  }];

  return context.createRun({
    templateId: 'gmail_followup_draft',
    title: `Seguimiento de correo: ${topic}`,
    requestedBy: payload.requestedBy || null,
    input: {
      to,
      topic,
      context: bodyContext || null,
      tone,
      signature: signature || null,
    },
    source: null,
    preview: {
      summary: followup.output.summary,
      confidence: followup.output.confidence,
      subject: followup.output.subject,
      body: followup.output.body,
      tone,
      signature: signature || null,
    },
    actions,
    status: 'needs_approval',
    initialLog: `Se preparo un correo de seguimiento para ${to}.`,
  });
}
