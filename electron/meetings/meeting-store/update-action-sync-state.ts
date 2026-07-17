import type { MeetingStore } from '../meeting-store.ts';
import { getMeetingHubClient } from '../meeting-hub-client';
import type { MeetingSyncActionState } from '../meeting-types';
import { nowIso, throwOnError } from './shared';

export async function updateActionSyncState(this: MeetingStore, actionId: string, syncState: MeetingSyncActionState, externalRef?: string | null, errorMessage?: string | null): Promise<void> {
    const supabase = getMeetingHubClient();
    const { error } = await supabase
      .from('meeting_sync_actions')
      .update({
        sync_state: syncState,
        external_ref: externalRef ?? null,
        error_message: errorMessage ?? null,
        updated_at: nowIso(),
      })
      .eq('id', actionId);

    throwOnError(error, 'updateActionSyncState');
  }
