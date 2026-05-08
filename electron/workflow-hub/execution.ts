import { resolveDriveFolderPreset, resolveMailPresetQuery } from './preset-resolvers';
import { normalizeOptionalString, requireNonEmptyString } from './normalizers';
import type { ExecuteWorkflowInput, WorkflowCaseDetail } from './types';
import type { WorkflowHubServiceContext } from './service-context';
import { resolveWorkflowExecution } from './workflow-config';
import { mapAutomationRunToDetail } from './case-mappers';
import { executeMeetingWorkflow } from './meeting-execution';

export async function executeWorkflow(
  ctx: WorkflowHubServiceContext,
  input: ExecuteWorkflowInput,
): Promise<WorkflowCaseDetail> {
  const resolved = resolveWorkflowExecution(ctx, input);
  const requestedBy = input.requestedBy || null;

  switch (resolved.workflow.id) {
    case 'correo': return executeMailWorkflow(ctx, resolved.config, requestedBy);
    case 'agenda': return executeAgendaWorkflow(ctx, resolved.config, requestedBy);
    case 'seguimiento': return executeFollowupWorkflow(ctx, resolved.config, requestedBy);
    case 'reuniones': return executeMeetingWorkflow(ctx, resolved.config, requestedBy);
    case 'drive': return executeDriveWorkflow(ctx, resolved.config, requestedBy);
    case 'actualizacion_equipo': return executeTeamUpdateWorkflow(ctx, resolved.config, requestedBy);
    case 'pc': return executeDesktopWorkflow(ctx, resolved.config, requestedBy);
    default: throw new Error('Workflow no soportado.');
  }
}

async function executeMailWorkflow(ctx: WorkflowHubServiceContext, config: Record<string, unknown>, requestedBy: string | null) {
  const preset = String(config.preset || 'unread').trim();
  const query = preset === 'custom' ? String(config.query || '').trim() : resolveMailPresetQuery(preset);
  const run = await ctx.deps.workspaceAutomationService.executeTemplate({
    templateId: 'gmail_triage',
    requestedBy,
    input: { query, maxResults: config.maxResults, gchatSpace: config.gchatSpace || undefined, removeFromInbox: config.removeFromInbox !== false },
  });
  return mapAutomationRunToDetail(ctx, run);
}

async function executeAgendaWorkflow(ctx: WorkflowHubServiceContext, config: Record<string, unknown>, requestedBy: string | null) {
  const run = await ctx.deps.workspaceAutomationService.executeTemplate({
    templateId: 'calendar_daily_brief',
    requestedBy,
    input: { targetDate: normalizeOptionalString(config.targetDate) || undefined, gchatSpace: normalizeOptionalString(config.gchatSpace) || undefined },
  });
  return mapAutomationRunToDetail(ctx, run);
}

async function executeFollowupWorkflow(ctx: WorkflowHubServiceContext, config: Record<string, unknown>, requestedBy: string | null) {
  const to = requireNonEmptyString(config.to, 'Necesito el correo destino para preparar el seguimiento.');
  const topic = requireNonEmptyString(config.topic, 'Necesito el tema o motivo del seguimiento.');
  const run = await ctx.deps.workspaceAutomationService.executeTemplate({
    templateId: 'gmail_followup_draft',
    requestedBy,
    input: { to, topic, context: normalizeOptionalString(config.context) || undefined, tone: normalizeOptionalString(config.tone) || undefined, signature: normalizeOptionalString(config.signature) || undefined },
  });
  return mapAutomationRunToDetail(ctx, run);
}

async function executeDriveWorkflow(ctx: WorkflowHubServiceContext, config: Record<string, unknown>, requestedBy: string | null) {
  const projectName = requireNonEmptyString(config.projectName, 'Necesito el nombre del proyecto o cliente.');
  const run = await ctx.deps.workspaceAutomationService.executeTemplate({
    templateId: 'drive_project_workspace',
    requestedBy,
    input: { projectName, parentFolderId: normalizeOptionalString(config.parentFolderId) || undefined, gchatSpace: normalizeOptionalString(config.gchatSpace) || undefined, folders: resolveDriveFolderPreset(String(config.folderPreset || 'cliente_estandar')) },
  });
  return mapAutomationRunToDetail(ctx, run);
}

async function executeTeamUpdateWorkflow(ctx: WorkflowHubServiceContext, config: Record<string, unknown>, requestedBy: string | null) {
  const spaceName = requireNonEmptyString(config.spaceName, 'Necesito el espacio de Google Chat.');
  const context = requireNonEmptyString(config.context, 'Necesito el contexto de la actualizacion.');
  const run = await ctx.deps.workspaceAutomationService.executeTemplate({
    templateId: 'gchat_executive_update',
    requestedBy,
    input: { spaceName, context, tone: normalizeOptionalString(config.tone) || undefined },
  });
  return mapAutomationRunToDetail(ctx, run);
}

async function executeDesktopWorkflow(ctx: WorkflowHubServiceContext, config: Record<string, unknown>, requestedBy: string | null) {
  const objective = requireNonEmptyString(config.objective, 'Necesito el objetivo de la accion en tu computadora.');
  const run = await ctx.deps.workspaceAutomationService.executeTemplate({
    templateId: 'desktop_action',
    requestedBy,
    input: { objective, backend: normalizeOptionalString(config.backend) || undefined, startUrl: normalizeOptionalString(config.startUrl) || undefined },
  });
  return mapAutomationRunToDetail(ctx, run);
}
