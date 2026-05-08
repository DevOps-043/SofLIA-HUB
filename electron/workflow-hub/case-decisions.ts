import type { UpdateMeetingActionInput } from '../meetings/meeting-types';
import { parseCaseId, requireNonEmptyString } from './normalizers';
import type { WorkflowApprovalScope, WorkflowCaseDetail } from './types';
import type { WorkflowHubServiceContext } from './service-context';
import { mapAutomationRunToDetail } from './case-mappers';
import { mapMeetingRunToDetail } from './meeting-case-mapper';

export async function approveCase(
  ctx: WorkflowHubServiceContext,
  input: { caseId: string; decidedBy: string; scope: WorkflowApprovalScope; actionId?: string; comment?: string | null },
): Promise<WorkflowCaseDetail> {
  const resolved = parseCaseId(input.caseId);
  if (resolved.engine === 'automation') {
    if (input.scope !== 'case') throw new Error('Ese tipo de aprobacion solo aplica a reuniones.');
    const run = await ctx.deps.workspaceAutomationService.approveRun(resolved.nativeId, input.decidedBy, input.comment || null);
    return mapAutomationRunToDetail(ctx, run);
  }
  if (input.scope === 'summary') {
    const detail = await ctx.deps.meetingWorkflowService.approveAsset(resolved.nativeId, input.decidedBy, input.comment || undefined);
    return mapMeetingRunToDetail(ctx, detail);
  }
  if (input.scope === 'actions') {
    const detail = await ctx.deps.meetingWorkflowService.approveActions(resolved.nativeId, input.decidedBy, undefined, input.comment || undefined);
    return mapMeetingRunToDetail(ctx, detail);
  }
  if (input.scope === 'action') {
    const actionId = requireNonEmptyString(input.actionId, 'Necesito la accion que quieres aprobar.');
    const detail = await ctx.deps.meetingWorkflowService.approveActions(resolved.nativeId, input.decidedBy, [actionId], input.comment || undefined);
    return mapMeetingRunToDetail(ctx, detail);
  }
  throw new Error('Tipo de aprobacion no soportado.');
}

export async function rejectCase(
  ctx: WorkflowHubServiceContext,
  input: { caseId: string; decidedBy: string; scope: 'case' | 'action'; actionId?: string; comment?: string | null },
): Promise<WorkflowCaseDetail> {
  const resolved = parseCaseId(input.caseId);
  if (resolved.engine === 'automation') {
    if (input.scope !== 'case') throw new Error('Ese tipo de rechazo solo aplica a reuniones.');
    const run = ctx.deps.workspaceAutomationService.rejectRun(resolved.nativeId, input.decidedBy, input.comment || null);
    return mapAutomationRunToDetail(ctx, run);
  }
  if (input.scope !== 'action') throw new Error('En reuniones solo puedes rechazar acciones individuales.');
  const actionId = requireNonEmptyString(input.actionId, 'Necesito la accion que quieres rechazar.');
  const detail = await ctx.deps.meetingWorkflowService.rejectAction(actionId, input.decidedBy, input.comment || undefined);
  return mapMeetingRunToDetail(ctx, detail);
}

export async function updateCaseAction(
  ctx: WorkflowHubServiceContext,
  input: { caseId: string; actionId: string; updates: UpdateMeetingActionInput },
): Promise<WorkflowCaseDetail> {
  const resolved = parseCaseId(input.caseId);
  if (resolved.engine !== 'meeting') throw new Error('Solo las reuniones permiten editar acciones sincronizables.');
  const detail = await ctx.deps.meetingWorkflowService.updateAction(
    requireNonEmptyString(input.actionId, 'Necesito la accion a editar.'),
    input.updates,
  );
  return mapMeetingRunToDetail(ctx, detail);
}

export async function syncCase(
  ctx: WorkflowHubServiceContext,
  input: { caseId: string; decidedBy: string },
): Promise<WorkflowCaseDetail> {
  const resolved = parseCaseId(input.caseId);
  if (resolved.engine !== 'meeting') throw new Error('Solo las reuniones requieren sincronizacion posterior.');
  const result = await ctx.deps.meetingWorkflowService.syncApprovedActions(resolved.nativeId, input.decidedBy);
  return mapMeetingRunToDetail(ctx, result.detail);
}
