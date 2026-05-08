import type { MeetingStore } from '../meeting-store.ts';
import { getMeetingIrisClient } from '../meeting-iris-client';
import type { MeetingRunStatus } from '../meeting-types';
import { nowIso, throwOnError } from './shared';

export async function updateRunStatus(this: MeetingStore, runId: string, status: MeetingRunStatus, lastError?: string | null): Promise<void> {
    const supabase = getMeetingIrisClient();
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
