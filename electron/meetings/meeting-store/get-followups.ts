import type { MeetingStore } from '../meeting-store.ts';
import type { MeetingFollowupItem, MeetingSyncActionRecord } from '../meeting-types';

export async function getFollowups(this: MeetingStore, ownerUserId?: string): Promise<MeetingFollowupItem[]> {
    const summaries = await this.listRuns(ownerUserId ? { ownerUserId } : undefined);
    const followups: MeetingFollowupItem[] = [];
    const now = Date.now();

    for (const summary of summaries) {
      const detail = await this.getRunDetail(summary.run.id);
      if (!detail?.latest_asset) continue;

      const actionByCommitmentIndex = new Map<number, MeetingSyncActionRecord>();
      for (const action of detail.sync_actions) {
        const index = action.payload.source_commitment_index;
        if (typeof index === 'number') {
          actionByCommitmentIndex.set(index, action);
        }
      }

      detail.latest_asset.payload.commitments.forEach((commitment, index) => {
        if (commitment.status === 'resolved') return;
        const due = commitment.due_date_candidate ? new Date(commitment.due_date_candidate).getTime() : null;
        const dueInHours = due ? Math.round((due - now) / (1000 * 60 * 60)) : null;
        let status: MeetingFollowupItem['status'] = 'open';
        if (typeof dueInHours === 'number' && dueInHours < 0) status = 'overdue';
        if (typeof dueInHours === 'number' && dueInHours >= 0 && dueInHours <= 48) status = 'upcoming';

        const relatedAction = actionByCommitmentIndex.get(index);
        followups.push({
          run_id: summary.run.id,
          meeting_title: summary.run.meeting_title,
          owner_user_id: summary.run.owner_user_id,
          commitment,
          assignee_id: relatedAction?.payload.assignee_id || null,
          due_in_hours: dueInHours,
          status,
        });
      });
    }

    return followups;
  }
