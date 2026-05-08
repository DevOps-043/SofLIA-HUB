import type { MeetingStore } from '../meeting-store.ts';
import { getMeetingIrisClient } from '../meeting-iris-client';
import type { MeetingSyncActionRecord } from '../meeting-types';
import { nowIso, throwOnError } from './shared';

export async function rejectAction(this: MeetingStore, actionId: string, decidedByUserId: string, comment?: string): Promise<MeetingSyncActionRecord | null> {
    const supabase = getMeetingIrisClient();
    const row = await this.getAction(actionId);
    if (!row) return null;

    const { error } = await supabase
      .from('meeting_sync_actions')
      .update({
        approval_state: 'rejected',
        sync_state: 'rejected',
        updated_at: nowIso(),
      })
      .eq('id', actionId);

    throwOnError(error, 'rejectAction.update');

    await this.recordApproval({
      meeting_run_id: row.meeting_run_id,
      scope: 'action',
      scope_ref_id: actionId,
      requested_by_user_id: decidedByUserId,
      decided_by_user_id: decidedByUserId,
      decision: 'rejected',
      comment: comment ?? null,
    });

    return this.getAction(actionId);
  }
