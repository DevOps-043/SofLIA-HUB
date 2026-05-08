import type { MeetingStore } from '../meeting-store.ts';
import type { MeetingSyncActionRecord } from '../meeting-types';
import { parseJson } from './shared';

export function mapSyncAction(this: MeetingStore, row: any): MeetingSyncActionRecord {
    return {
      id: row.id,
      meeting_run_id: row.meeting_run_id,
      meeting_asset_id: row.meeting_asset_id,
      action_type: row.action_type,
      target_type: row.target_type,
      payload: parseJson(row.payload_json, {}),
      approval_state: row.approval_state,
      sync_state: row.sync_state,
      sync_target: row.sync_target,
      idempotency_key: row.idempotency_key,
      external_ref: row.external_ref ?? null,
      error_message: row.error_message ?? null,
      summary: row.summary,
      blocking_flags: parseJson(row.blocking_flags_json, []),
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
