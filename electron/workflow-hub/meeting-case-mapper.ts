import type { MeetingRunDetail } from '../meetings/meeting-types';
import { normalizeMeetingActionStatus } from './normalizers';
import type { WorkflowCaseDetail } from './types';
import type { WorkflowHubServiceContext } from './service-context';
import { mapMeetingRunToSummary } from './case-mappers';

export function mapMeetingRunToDetail(
  ctx: WorkflowHubServiceContext,
  detail: MeetingRunDetail,
): WorkflowCaseDetail {
  const summary = mapMeetingRunToSummary(ctx, {
    run: detail.run,
    latest_asset: detail.latest_asset
      ? {
          id: detail.latest_asset.id,
          executive_summary: detail.latest_asset.executive_summary,
          operational_summary: detail.latest_asset.operational_summary,
          review_flags: detail.latest_asset.review_flags,
          created_at: detail.run.updated_at,
        }
      : null,
    counts: {
      draft_actions: detail.sync_actions.filter((action) => action.approval_state === 'draft').length,
      approved_actions: detail.sync_actions.filter((action) => action.approval_state === 'approved').length,
      synced_actions: detail.sync_actions.filter((action) => action.sync_state === 'synced').length,
      failed_actions: detail.sync_actions.filter((action) => action.sync_state === 'failed').length,
    },
  });

  const reasons = [
    ...(detail.latest_asset?.review_flags.map((flag) => flag.message) || []),
    ...detail.sync_actions.flatMap((action) => action.blocking_flags || []),
  ].filter(Boolean);

  return {
    ...summary,
    reasons,
    preview: detail.latest_asset?.payload.analysis_result
      ? {
          executiveSummary: detail.latest_asset.payload.analysis_result.executiveSummary,
          keyPoints: detail.latest_asset.payload.analysis_result.keyPoints,
          decisions: detail.latest_asset.payload.analysis_result.decisions.length,
          tasks: detail.latest_asset.payload.analysis_result.tasks.length,
          risks: detail.latest_asset.payload.analysis_result.risks.length,
        }
      : {},
    approvals: detail.approvals as unknown as Array<Record<string, unknown>>,
    logs: [],
    actionsDetail: detail.sync_actions.map((action) => ({
      id: action.id,
      title: action.payload.title || action.summary,
      kind: action.action_type,
      status: normalizeMeetingActionStatus(action.approval_state, action.sync_state, action.error_message),
      payload: action.payload as unknown as Record<string, unknown>,
      error: action.error_message,
      blockingFlags: action.blocking_flags,
      approvalState: action.approval_state,
      syncState: action.sync_state,
    })),
    capabilitiesUsed: ['calendar', 'drive', 'gmail', 'google_user_mapping'],
    meetingDetail: structuredClone(detail),
  };
}
