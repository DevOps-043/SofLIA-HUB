import type { MeetingStore } from '../meeting-store.ts';
import { getMeetingHubClient } from '../meeting-hub-client';
import { throwOnError } from './shared';

export async function getNextSourceVersion(this: MeetingStore, ownerUserId: string, sourceUri?: string | null): Promise<number> {
    if (!sourceUri) return 1;

    const supabase = getMeetingHubClient();
    const { data, error } = await supabase
      .from('meeting_runs')
      .select('source_version')
      .eq('owner_user_id', ownerUserId)
      .eq('primary_source_uri', sourceUri)
      .order('source_version', { ascending: false })
      .limit(1);

    throwOnError(error, 'getNextSourceVersion');
    return data?.[0]?.source_version ? Number(data[0].source_version) + 1 : 1;
  }
