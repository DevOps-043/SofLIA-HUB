import type { MeetingStore } from '../meeting-store.ts';
import { getMeetingHubClient } from '../meeting-hub-client';
import type { MeetingApprovalRecord } from '../meeting-types';
import { nowIso, makeId, throwOnError } from './shared';

export async function recordApproval(this: MeetingStore, input: Omit<MeetingApprovalRecord, 'id' | 'created_at' | 'decided_at'>): Promise<void> {
    const supabase = getMeetingHubClient();
    const createdAt = nowIso();
    const { error } = await supabase
      .from('meeting_approvals')
      .insert({
        ...input,
        id: makeId('mapproval'),
        created_at: createdAt,
        decided_at: input.decided_by_user_id ? createdAt : null,
      });

    throwOnError(error, 'recordApproval');
  }
