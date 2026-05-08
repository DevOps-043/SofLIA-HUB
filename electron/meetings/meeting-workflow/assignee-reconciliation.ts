import type { getTeamMembersDetailed } from '../../iris-data-main';
import type { MeetingAssigneeService } from '../meeting-assignee-service';
import type { MeetingReviewService } from '../meeting-review-service';
import type { MeetingSyncActionPayload, ProposedMeetingAction } from '../meeting-types';

interface AssigneeDeps {
  assigneeService: MeetingAssigneeService;
  getTeamMembersDetailed: typeof getTeamMembersDetailed;
}

export async function resolveAssigneesForActions(
  deps: AssigneeDeps & { reviewService: MeetingReviewService },
  actions: ProposedMeetingAction[],
): Promise<ProposedMeetingAction[]> {
  return Promise.all(actions.map(async (action) => {
    const payload = await reconcileActionPayload(deps, action.payload);
    return { ...action, payload, blocking_flags: deps.reviewService.getBlockingFlagsForPayload(payload) };
  }));
}

export async function reconcileActionPayload(deps: AssigneeDeps, payload: MeetingSyncActionPayload): Promise<MeetingSyncActionPayload> {
  const nextPayload: MeetingSyncActionPayload = {
    ...payload,
    owner_candidate: payload.owner_candidate ?? null,
    assignee_id: payload.assignee_id ?? null,
    due_date: payload.due_date ?? null,
  };
  if (!nextPayload.team_id) return nextPayload;

  const teamMembers = await deps.getTeamMembersDetailed(nextPayload.team_id);
  const assigneeStillValid = nextPayload.assignee_id
    ? teamMembers.some((member) => member.user_id === nextPayload.assignee_id)
    : false;
  if (nextPayload.assignee_id && !assigneeStillValid) nextPayload.assignee_id = null;
  if (!nextPayload.assignee_id && nextPayload.owner_candidate) {
    nextPayload.assignee_id = deps.assigneeService.resolveAssigneeId(nextPayload.owner_candidate, teamMembers);
  }
  return nextPayload;
}
