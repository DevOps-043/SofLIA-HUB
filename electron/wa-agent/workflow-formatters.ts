/**
 * Presentacion de respuestas del Workflow Hub para WhatsApp.
 *
 * Formatear texto de salida es responsabilidad del adaptador WhatsApp; el
 * agente principal solo orquesta y envia el mensaje ya armado.
 */

import type { WorkflowHubService } from '../workflow-hub-service';

type WorkflowHubOverview = Awaited<ReturnType<WorkflowHubService['getOverview']>>;

export function normalizeWorkflowCaseId(caseId: string): string {
  const normalized = caseId.trim();
  if (!normalized) {
    throw new Error('Necesito el identificador del caso.');
  }
  if (normalized.includes(':')) {
    return normalized;
  }
  return `automation:${normalized}`;
}

export function formatPendingCases(overview: WorkflowHubOverview): string {
  const pendingCases = overview.cases.filter((item) => item.normalizedStatus === 'pending_approval');
  if (pendingCases.length === 0) {
    return 'No hay decisiones pendientes por autorizar en este momento.';
  }

  return [
    '*Pendientes por autorizar*',
    ...pendingCases.slice(0, 5).map((item, index) => `${index + 1}. ${item.title}\nCASE_ID: ${item.id}\nResumen: ${item.summary}\nPendientes: ${item.actions.pending}`),
    '',
    'Para autorizar: /aprobar CASE_ID',
    'Para rechazar: /rechazar CASE_ID',
  ].join('\n\n');
}

export function formatWorkflowCatalogList(overview: WorkflowHubOverview): string {
  const variantCountByWorkflow = overview.variants.reduce<Record<string, number>>((acc, variant) => {
    acc[variant.workflowId] = (acc[variant.workflowId] || 0) + 1;
    return acc;
  }, {});
  const passiveLines = overview.passiveRules.map((rule) => `- ${rule.name}: ${rule.scheduleLabel} (${rule.workflowName})`);

  return [
    '*Workflows disponibles*',
    '',
    '*Pasivos*',
    ...overview.workflows
      .filter((workflow) => workflow.triggerModes.includes('passive'))
      .map((workflow) => `- ${workflow.name}: ${workflow.summary} (${workflow.passiveBehavior === 'system' ? 'automatico' : 'programable'})`),
    passiveLines.length > 0 ? '' : null,
    passiveLines.length > 0 ? '*Rutinas guardadas*' : null,
    ...passiveLines,
    '',
    '*De activacion*',
    ...overview.workflows
      .filter((workflow) => workflow.triggerModes.includes('activation'))
      .map((workflow) => `- ${workflow.name}: ${workflow.summary} (variantes: ${variantCountByWorkflow[workflow.id] || 0})`),
    overview.legacyCustomTemplates.length > 0 ? `Legacy ocultos: ${overview.legacyCustomTemplates.length}` : null,
    '',
    'Tip: tambien puedes pedirme cosas como "dame mis correos a las 8 am" y lo guardare como workflow pasivo sin comandos especiales.',
  ].filter(Boolean).join('\n');
}

export function formatWorkflowCaseResponse(detail: Record<string, any>, intro?: string): string {
  const actions = Array.isArray(detail.actionsDetail) ? detail.actionsDetail : [];
  const lines = [
    intro || null,
    `Caso: ${detail.id}`,
    `Workflow: ${detail.workflowName || detail.workflowId || 'n/d'}`,
    `Estado: ${detail.nativeStatus || detail.normalizedStatus || 'n/d'}`,
    `Titulo: ${detail.title || 'Sin titulo'}`,
    `Resumen: ${detail.summary || 'Sin resumen.'}`,
    actions.length > 0 ? `Acciones: ${actions.length}` : null,
    ...actions.slice(0, 5).map((action: any) => `- ${action.title} | ${action.status}`),
    detail.normalizedStatus === 'pending_approval' ? 'Siguiente paso: /aprobar CASE_ID o /rechazar CASE_ID' : 'Puedes usar /pendientes para revisar otros casos.',
  ];

  return lines.filter(Boolean).join('\n');
}
