import type { MeetingStore } from '../meeting-store.ts';
import { getMeetingIrisClient } from '../meeting-iris-client';
import type { MeetingSyncActionRecord } from '../meeting-types';
import { throwOnError } from './shared';

export async function getApprovedPendingActions(this: MeetingStore, runId: string): Promise<MeetingSyncActionRecord[]> {
    const supabase = getMeetingIrisClient();
    const { data, error } = await supabase
      .from('meeting_sync_actions')
      .select('*')
      .eq('meeting_run_id', runId)
      .eq('approval_state', 'approved')
      .in('sync_state', ['draft', 'failed'])
      .order('created_at', { ascending: true });

    throwOnError(error, 'getApprovedPendingActions');
    return (data || []).map((row) => this.mapSyncAction(row));
  }
