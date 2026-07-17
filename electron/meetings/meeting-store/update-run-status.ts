import type { MeetingStore } from '../meeting-store.ts';
import { getMeetingHubClient } from '../meeting-hub-client';
import type { MeetingRunStatus } from '../meeting-types';
import { nowIso, throwOnError } from './shared';

export async function updateRunStatus(this: MeetingStore, runId: string, status: MeetingRunStatus, lastError?: string | null): Promise<void> {
    const supabase = getMeetingHubClient();
    const { error } = await supabase
      .from('meeting_runs')
      .update({
        status,
        last_error: lastError ?? null,
        updated_at: nowIso(),
      })
      .eq('id', runId);

    throwOnError(error, 'updateRunStatus');
  }
