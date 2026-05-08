import type { MeetingStore } from '../meeting-store.ts';
import type { MeetingRunRecord } from '../meeting-types';

export function mapRun(this: MeetingStore, row: any): MeetingRunRecord {
    return {
      id: row.id,
      organization_id: row.organization_id ?? null,
      workspace_id: row.workspace_id ?? null,
      owner_user_id: row.owner_user_id,
      origin_channel: row.origin_channel,
      origin_ref: row.origin_ref ?? null,
      meeting_title: row.meeting_title ?? null,
      meeting_type: row.meeting_type,
      meeting_series_key: row.meeting_series_key ?? null,
      primary_source_uri: row.primary_source_uri ?? null,
      status: row.status,
      source_hash: row.source_hash,
      source_version: Number(row.source_version),
      trace_id: row.trace_id,
      last_error: row.last_error ?? null,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
