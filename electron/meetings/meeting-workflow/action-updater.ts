import type { getTeamMembersDetailed } from '../../iris-data-main';
import type { MeetingAssigneeService } from '../meeting-assignee-service';
import type { MeetingReviewService } from '../meeting-review-service';
import type { MeetingStore } from '../meeting-store';
import type { MeetingRunDetail, UpdateMeetingActionInput } from '../meeting-types';
import { reconcileActionPayload } from './assignee-reconciliation';

export async function updateMeetingActionDraft(
  deps: {
    store: MeetingStore;
    reviewService: MeetingReviewService;
    assigneeService: MeetingAssigneeService;
    getTeamMembersDetailed: typeof getTeamMembersDetailed;
    getRunDetail: (runId: string) => Promise<MeetingRunDetail>;
  },
  actionId: string,
  updates: UpdateMeetingActionInput,
): Promise<MeetingRunDetail> {
  const currentAction = await deps.store.getAction(actionId);
  if (!currentAction) throw new Error('No encontre la accion a actualizar.');
  const nextPayload = await reconcileActionPayload(deps, {
    ...currentAction.payload,
    ...(updates.title !== undefined ? { title: updates.title || undefined } : {}),
    ...(updates.description !== undefined ? { description: updates.description || undefined } : {}),
    ...(updates.team_id !== undefined ? { team_id: updates.team_id || undefined } : {}),
    ...(updates.project_id !== undefined ? { project_id: updates.project_id || undefined } : {}),
    ...(updates.due_date !== undefined ? { due_date: updates.due_date || null } : {}),
    ...(updates.owner_candidate !== undefined ? { owner_candidate: updates.owner_candidate || null } : {}),
    ...(updates.assignee_id !== undefined ? { assignee_id: updates.assignee_id || null } : {}),
    ...(updates.issue_id !== undefined ? { issue_id: updates.issue_id || undefined } : {}),
  });
  const action = await deps.store.updateActionDraft(actionId, {
    ...updates,
    owner_candidate: nextPayload.owner_candidate ?? null,
    assignee_id: nextPayload.assignee_id ?? null,
    summary: updates.summary || updates.title || undefined,
    blockingFlags: deps.reviewService.getBlockingFlagsForPayload(nextPayload),
  });
  if (!action) throw new Error('No encontre la accion a actualizar.');
  await deps.store.updateRunStatus(action.meeting_run_id, 'REVIEW_REQUIRED', null);
  return deps.getRunDetail(action.meeting_run_id);
}
