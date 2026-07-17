import type { MeetingStore } from '../meeting-store.ts';
import { getMeetingHubClient } from '../meeting-hub-client';
import { nowIso, throwOnError } from './shared';

export async function updateRunClassification(this: MeetingStore, runId: string, updates: { meetingTitle?: string | null; meetingType?: string }): Promise<void> {
    const nextPayload: Record<string, unknown> = {
      updated_at: nowIso(),
    };

    if (updates.meetingTitle !== undefined) {
      nextPayload.meeting_title = updates.meetingTitle;
    }
    if (updates.meetingType) {
      nextPayload.meeting_type = updates.meetingType;
    }

    const supabase = getMeetingHubClient();
    const { error } = await supabase
      .from('meeting_runs')
      .update(nextPayload)
      .eq('id', runId);

    throwOnError(error, 'updateRunClassification');
  }
