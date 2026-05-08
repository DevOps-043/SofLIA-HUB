import type { MeetingStore } from '../meeting-store.ts';
import { getMeetingIrisClient } from '../meeting-iris-client';
import type { MeetingSyncActionRecord } from '../meeting-types';
import { throwOnError } from './shared';

export async function getAction(this: MeetingStore, actionId: string): Promise<MeetingSyncActionRecord | null> {
    const supabase = getMeetingIrisClient();
    const { data, error } = await supabase
      .from('meeting_sync_actions')
      .select('*')
      .eq('id', actionId)
      .maybeSingle();

    throwOnError(error, 'getAction');
    return data ? this.mapSyncAction(data) : null;
  }
