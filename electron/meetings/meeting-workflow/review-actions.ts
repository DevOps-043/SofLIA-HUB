import type { MeetingStore } from '../meeting-store';
import type { MeetingRunDetail } from '../meeting-types';

export async function approveMeetingAsset(store: MeetingStore, getRunDetail: (runId: string) => Promise<MeetingRunDetail>, runId: string, decidedByUserId: string, comment?: string) {
  await getRunDetail(runId);
  await store.approveAsset(runId, decidedByUserId, comment);
  return getRunDetail(runId);
}

export async function approveMeetingActions(store: MeetingStore, refreshReviewStatus: (runId: string) => Promise<MeetingRunDetail>, runId: string, decidedByUserId: string, actionIds?: string[], comment?: string) {
  await store.approveActions(runId, decidedByUserId, actionIds, comment);
  return refreshReviewStatus(runId);
}

export async function rejectMeetingAction(store: MeetingStore, refreshReviewStatus: (runId: string) => Promise<MeetingRunDetail>, actionId: string, decidedByUserId: string, comment?: string) {
  const action = await store.rejectAction(actionId, decidedByUserId, comment);
  if (!action) throw new Error('No encontre la accion a rechazar.');
  return refreshReviewStatus(action.meeting_run_id);
}

export async function refreshMeetingReviewStatus(store: MeetingStore, getRunDetail: (runId: string) => Promise<MeetingRunDetail>, runId: string) {
  const detail = await getRunDetail(runId);
  const hasDraftActions = detail.sync_actions.some((action) => action.approval_state === 'draft');
  await store.updateRunStatus(runId, hasDraftActions ? 'REVIEW_REQUIRED' : 'APPROVED', null);
  return getRunDetail(runId);
}
