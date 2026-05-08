import crypto from 'node:crypto';
import { DESKTOP_ACTION_SCHEMA } from '../schemas';
import type { ExecuteTemplateInput, WorkflowActionRecord, WorkflowRunRecord } from '../types';
import type { WorkspaceTemplateHandlerContext } from './types';

export async function executeDesktopAction(
  payload: ExecuteTemplateInput,
  context: WorkspaceTemplateHandlerContext,
): Promise<WorkflowRunRecord> {
  const objective = String(payload.input?.objective || '').trim();
  const backend = typeof payload.input?.backend === 'string' ? payload.input.backend.trim() : '';
  const startUrl = typeof payload.input?.startUrl === 'string' ? payload.input.startUrl.trim() : '';

  if (!objective) {
    throw new Error('Necesito el objetivo de la accion en tu computadora.');
  }

  const planned = await context.llmTaskService.runJsonTask<{
    summary: string;
    rationale: string;
    task: string;
    confidence: number;
  }>({
    prompt: [
      'Convierte esta necesidad operativa en una instruccion clara para un agente de escritorio.',
      'La tarea debe ser concreta, segura y autocontenida.',
      'No inventes accesos ni confirmes resultados que aun no existen.',
    ].join('\n'),
    input: {
      objective,
      backend: backend || null,
      startUrl: startUrl || null,
    },
    schema: DESKTOP_ACTION_SCHEMA,
  });

  const actions: WorkflowActionRecord[] = [{
    id: crypto.randomUUID(),
    kind: 'desktop_task',
    title: 'Ejecutar accion en la computadora',
    status: 'pending',
    payload: {
      task: planned.output.task.trim(),
      backend: ['auto', 'browser', 'desktop', 'uia'].includes(backend) ? backend : undefined,
      startUrl: startUrl || undefined,
    },
  }];

  return context.createRun({
    templateId: 'desktop_action',
    title: `Accion en computadora: ${objective}`,
    requestedBy: payload.requestedBy || null,
    input: {
      objective,
      backend: backend || null,
      startUrl: startUrl || null,
    },
    source: null,
    preview: {
      summary: planned.output.summary,
      rationale: planned.output.rationale,
      confidence: planned.output.confidence,
      task: planned.output.task,
    },
    actions,
    status: 'needs_approval',
    initialLog: `Se preparo una accion de escritorio para: ${objective}.`,
  });
}
