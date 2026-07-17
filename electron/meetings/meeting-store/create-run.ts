import type { MeetingStore } from '../meeting-store.ts';
import { getMeetingHubClient } from '../meeting-hub-client';
import type { CreateMeetingRunInput, MeetingRunRecord } from '../meeting-types';
import { nowIso, makeId, throwOnError } from './shared';

export async function createRun(this: MeetingStore, input: CreateMeetingRunInput & { traceId: string; sourceVersion: number }): Promise<MeetingRunRecord> {
    const supabase = getMeetingHubClient();
    const timestamp = nowIso();
    const record: MeetingRunRecord = {
      id: makeId('mrun'),
      organization_id: input.organizationId ?? null,
      workspace_id: input.workspaceId ?? null,
      owner_user_id: input.ownerUserId,
      origin_channel: input.originChannel,
      origin_ref: input.originRef ?? null,
      meeting_title: input.meetingTitle ?? null,
      meeting_type: input.meetingType || 'general',
      meeting_series_key: input.meetingSeriesKey ?? null,
      primary_source_uri: input.source.source_uri ?? null,
      status: 'EXTRACTING',
      source_hash: input.source.content_hash,
      source_version: input.sourceVersion,
      trace_id: input.traceId,
      last_error: null,
      created_at: timestamp,
      updated_at: timestamp,
    };

    const { error } = await supabase
      .from('meeting_runs')
      .insert(record);

    throwOnError(error, 'createRun');
    return record;
  }
