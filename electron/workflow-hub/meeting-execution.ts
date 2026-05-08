import { normalizeOptionalString, requireNonEmptyString, resolveOwnerUserId } from './normalizers';
import type { WorkflowCaseDetail } from './types';
import type { WorkflowHubServiceContext } from './service-context';
import { mapAutomationRunToDetail } from './case-mappers';
import { mapMeetingRunToDetail } from './meeting-case-mapper';

export async function executeMeetingWorkflow(
  ctx: WorkflowHubServiceContext,
  config: Record<string, unknown>,
  requestedBy: string | null,
): Promise<WorkflowCaseDetail> {
  const mode = String(config.mode || 'manual').trim().toLowerCase();
  if (mode === 'prep') return executeMeetingPrep(ctx, config, requestedBy);
  if (mode === 'auto') {
    throw new Error('La deteccion automatica de reuniones corre en segundo plano. Usa manual, Drive o prep para crear un caso ahora.');
  }

  const shared = {
    ownerUserId: resolveOwnerUserId(requestedBy),
    originChannel: 'app' as const,
    originRef: 'workflow-hub:reuniones',
    meetingTitle: normalizeOptionalString(config.meetingTitle),
    meetingType: normalizeOptionalString(config.meetingType) || 'general',
    defaultTeamId: normalizeOptionalString(config.defaultTeamId),
    defaultProjectId: normalizeOptionalString(config.defaultProjectId),
  };

  if (mode === 'drive') {
    const fileIdOrUrl = requireNonEmptyString(config.driveRef, 'Necesito el link o ID de Google Drive.');
    const result = await ctx.deps.meetingWorkflowService.createDriveRun({ ...shared, fileIdOrUrl });
    return mapMeetingRunToDetail(ctx, result.detail);
  }

  const text = requireNonEmptyString(config.manualText, 'Necesito las notas o transcripcion para procesar la reunion.');
  const result = await ctx.deps.meetingWorkflowService.createManualRun({ ...shared, text });
  return mapMeetingRunToDetail(ctx, result.detail);
}

async function executeMeetingPrep(
  ctx: WorkflowHubServiceContext,
  config: Record<string, unknown>,
  requestedBy: string | null,
): Promise<WorkflowCaseDetail> {
  const run = await ctx.deps.workspaceAutomationService.executeTemplate({
    templateId: 'calendar_meeting_prep',
    requestedBy,
    input: {
      targetDate: normalizeOptionalString(config.targetDate) || undefined,
      gchatSpace: normalizeOptionalString(config.gchatSpace) || undefined,
    },
  });
  return mapAutomationRunToDetail(ctx, run);
}
