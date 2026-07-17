import type { MeetingStore } from '../meeting-store.ts';
import { getMeetingHubClient } from '../meeting-hub-client';
import type { MeetingRunRecord } from '../meeting-types';
import { throwOnError } from './shared';

export async function findRunByOwnerAndSourceHash(this: MeetingStore, ownerUserId: string, sourceHash: string): Promise<MeetingRunRecord | null> {
    const supabase = getMeetingHubClient();
    const { data, error } = await supabase
      .from('meeting_runs')
      .select('*')
      .eq('owner_user_id', ownerUserId)
      .eq('source_hash', sourceHash)
      .order('created_at', { ascending: false })
      .limit(1);

    throwOnError(error, 'findRunByOwnerAndSourceHash');
    return data?.[0] ? this.mapRun(data[0]) : null;
  }
