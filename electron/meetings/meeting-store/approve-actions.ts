import type { MeetingStore } from '../meeting-store.ts';
import { getMeetingIrisClient } from '../meeting-iris-client';
import type { MeetingSyncActionRecord } from '../meeting-types';
import { nowIso, throwOnError } from './shared';

export async function approveActions(this: MeetingStore, runId: string, decidedByUserId: string, actionIds?: string[], comment?: string): Promise<MeetingSyncActionRecord[]> {
    const supabase = getMeetingIrisClient();
    let targetIds = actionIds?.filter(Boolean) || [];

    if (targetIds.length === 0) {
      const { data, error } = await supabase
        .from('meeting_sync_actions')
        .select('id')
        .eq('meeting_run_id', runId)
        .eq('approval_state', 'draft');

      throwOnError(error, 'approveActions.selectDrafts');
      targetIds = (data || []).map((row) => row.id as string);
    }

    if (targetIds.length > 0) {
      const { error: updateError } = await supabase
        .from('meeting_sync_actions')
        .update({
          approval_state: 'approved',
          updated_at: nowIso(),
        })
        .in('id', targetIds);

      throwOnError(updateError, 'approveActions.update');

      await Promise.all(
        targetIds.map((actionId) =>
          this.recordApproval({
            meeting_run_id: runId,
            scope: 'action',
            scope_ref_id: actionId,
            requested_by_user_id: decidedByUserId,
            decided_by_user_id: decidedByUserId,
            decision: 'approved',
            comment: comment ?? null,
          })),
      );
    }

    if (!actionIds || actionIds.length === 0) {
      await this.recordApproval({
        meeting_run_id: runId,
        scope: 'actions',
        scope_ref_id: null,
        requested_by_user_id: decidedByUserId,
        decided_by_user_id: decidedByUserId,
        decision: 'approved',
        comment: comment ?? null,
      });
    }

    return (await this.getRunDetail(runId))?.sync_actions ?? [];
  }
