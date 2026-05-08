import {
  normalizeEnum,
  normalizeNumber,
  normalizeOptionalString,
} from './normalizers';
import type { ExecuteWorkflowInput, WorkflowDefinition, WorkflowId } from './types';
import type { WorkflowHubServiceContext } from './service-context';

export function resolveWorkflowExecution(
  ctx: WorkflowHubServiceContext,
  input: ExecuteWorkflowInput,
): { workflow: WorkflowDefinition; config: Record<string, unknown> } {
  const variant = input.variantId
    ? ctx.state.variants.find((candidate) => candidate.id === input.variantId)
    : null;
  const workflowId = variant?.workflowId || input.workflowId;
  if (!workflowId) throw new Error('Necesito saber que workflow quieres ejecutar.');
  const workflow = ctx.getWorkflowDefinition(workflowId);
  const merged = {
    ...structuredClone(workflow.defaultConfig),
    ...(variant?.config || {}),
    ...(input.input || {}),
  };
  return { workflow, config: sanitizeWorkflowConfig(workflow.id, merged) };
}

export function sanitizeWorkflowConfig(workflowId: WorkflowId, config: Record<string, unknown>): Record<string, unknown> {
  switch (workflowId) {
    case 'correo': return {
      preset: normalizeEnum(config.preset, ['today', 'unread', 'priority', 'custom'], 'unread'),
      query: normalizeOptionalString(config.query) || '',
      maxResults: normalizeNumber(config.maxResults, 5, 1, 10),
      gchatSpace: normalizeOptionalString(config.gchatSpace) || '',
      removeFromInbox: config.removeFromInbox !== false,
    };
    case 'agenda': return {
      targetDate: normalizeOptionalString(config.targetDate) || '',
      gchatSpace: normalizeOptionalString(config.gchatSpace) || '',
    };
    case 'seguimiento': return {
      to: normalizeOptionalString(config.to) || '',
      topic: normalizeOptionalString(config.topic) || '',
      context: normalizeOptionalString(config.context) || '',
      tone: normalizeOptionalString(config.tone) || 'profesional y claro',
      signature: normalizeOptionalString(config.signature) || '',
    };
    case 'reuniones': return sanitizeMeetingConfig(config);
    case 'drive': return {
      projectName: normalizeOptionalString(config.projectName) || '',
      parentFolderId: normalizeOptionalString(config.parentFolderId) || '',
      gchatSpace: normalizeOptionalString(config.gchatSpace) || '',
      folderPreset: normalizeEnum(config.folderPreset, ['cliente_estandar', 'proyecto_simple', 'operacion'], 'cliente_estandar'),
    };
    case 'actualizacion_equipo': return {
      spaceName: normalizeOptionalString(config.spaceName) || '',
      context: normalizeOptionalString(config.context) || '',
      tone: normalizeOptionalString(config.tone) || 'ejecutivo y claro',
    };
    case 'pc': return {
      objective: normalizeOptionalString(config.objective) || '',
      backend: normalizeEnum(config.backend, ['auto', 'browser', 'desktop', 'uia'], 'auto'),
      startUrl: normalizeOptionalString(config.startUrl) || '',
    };
    default: return {};
  }
}

function sanitizeMeetingConfig(config: Record<string, unknown>): Record<string, unknown> {
  return {
    mode: normalizeEnum(config.mode, ['prep', 'manual', 'drive', 'auto'], 'manual'),
    targetDate: normalizeOptionalString(config.targetDate) || '',
    gchatSpace: normalizeOptionalString(config.gchatSpace) || '',
    meetingTitle: normalizeOptionalString(config.meetingTitle) || '',
    meetingType: normalizeOptionalString(config.meetingType) || 'general',
    defaultTeamId: normalizeOptionalString(config.defaultTeamId) || '',
    defaultProjectId: normalizeOptionalString(config.defaultProjectId) || '',
    manualText: normalizeOptionalString(config.manualText) || '',
    driveRef: normalizeOptionalString(config.driveRef) || '',
  };
}
