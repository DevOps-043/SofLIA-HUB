import type { MeetingRunSummary } from '../meetings/meeting-types';
import type { WorkflowActionRecord, WorkflowRunRecord } from '../workspace-automation-service';
import { AUTOMATION_CASE_PREFIX, AUTOMATION_TEMPLATE_TO_WORKFLOW, MEETING_CASE_PREFIX } from './definitions';
import { normalizeAutomationStatus, normalizeMeetingStatus } from './normalizers';
import type { WorkflowCaseAction, WorkflowCaseDetail, WorkflowCaseSummary } from './types';
import type { WorkflowHubServiceContext } from './service-context';

export function mapAutomationRunToSummary(
  ctx: WorkflowHubServiceContext,
  run: WorkflowRunRecord,
): WorkflowCaseSummary {
  const workflowId = AUTOMATION_TEMPLATE_TO_WORKFLOW[run.templateId];
  const workflow = ctx.getWorkflowDefinition(workflowId);
  const actions = mapAutomationActions(run.actions);
  const reasons = run.actions.filter((action) => action.error).map((action) => action.error || '').filter(Boolean);
  return {
    id: `${AUTOMATION_CASE_PREFIX}${run.id}`,
    nativeId: run.id,
    workflowId,
    workflowName: workflow.name,
    engine: 'automation',
    title: run.title,
    summary: run.summary,
    normalizedStatus: normalizeAutomationStatus(run.status),
    nativeStatus: run.status,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
    actions: {
      pending: actions.filter((action) => action.status === 'pending').length,
      approved: actions.filter((action) => action.status === 'executed').length,
      failed: actions.filter((action) => action.status === 'failed').length,
      total: actions.length,
    },
    reasons,
  };
}

export function mapAutomationRunToDetail(ctx: WorkflowHubServiceContext, run: WorkflowRunRecord): WorkflowCaseDetail {
  const summary = mapAutomationRunToSummary(ctx, run);
  return {
    ...summary,
    preview: run.preview || {},
    approvals: run.approvals as unknown as Array<Record<string, unknown>>,
    logs: run.logs || [],
    actionsDetail: mapAutomationActions(run.actions),
    capabilitiesUsed: ctx.getWorkflowDefinition(summary.workflowId).requiredCapabilities,
    automationRun: structuredClone(run),
  };
}

export function mapAutomationActions(actions: WorkflowActionRecord[]): WorkflowCaseAction[] {
  return actions.map((action) => ({
    id: action.id,
    title: action.title,
    kind: action.kind,
    status: action.status,
    payload: action.payload || {},
    error: action.error,
    approvalState: null,
    syncState: null,
  }));
}

export function mapMeetingRunToSummary(
  ctx: WorkflowHubServiceContext,
  run: MeetingRunSummary,
): WorkflowCaseSummary {
  const reasons = [...(run.latest_asset?.review_flags.map((flag) => flag.message) || [])];
  return {
    id: `${MEETING_CASE_PREFIX}${run.run.id}`,
    nativeId: run.run.id,
    workflowId: 'reuniones',
    workflowName: ctx.getWorkflowDefinition('reuniones').name,
    engine: 'meeting',
    title: run.run.meeting_title || 'Reunion sin titulo',
    summary: run.latest_asset?.executive_summary || 'Caso de reunion listo para revision.',
    normalizedStatus: normalizeMeetingStatus(run.run.status),
    nativeStatus: run.run.status,
    createdAt: run.run.created_at,
    updatedAt: run.run.updated_at,
    actions: {
      pending: run.counts.draft_actions,
      approved: run.counts.approved_actions + run.counts.synced_actions,
      failed: run.counts.failed_actions,
      total: run.counts.draft_actions + run.counts.approved_actions + run.counts.synced_actions + run.counts.failed_actions,
    },
    reasons,
  };
}
