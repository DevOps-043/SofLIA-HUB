import type { MeetingStore } from '../meeting-store.ts';
import crypto from 'node:crypto';
import { getMeetingHubClient } from '../meeting-hub-client';
import type { MeetingSyncActionRecord, ProposedMeetingAction } from '../meeting-types';
import { nowIso, makeId, throwOnError } from './shared';

export async function replaceSyncActions(this: MeetingStore, runId: string, assetId: string, actions: ProposedMeetingAction[]): Promise<MeetingSyncActionRecord[]> {
    const supabase = getMeetingHubClient();

    const { error: deleteError } = await supabase
      .from('meeting_sync_actions')
      .delete()
      .eq('meeting_run_id', runId)
      .eq('approval_state', 'draft');

    throwOnError(deleteError, 'replaceSyncActions.deleteDrafts');

    const records = actions.map((action) => {
      const createdAt = nowIso();
      const record: MeetingSyncActionRecord = {
        id: makeId('mact'),
        meeting_run_id: runId,
        meeting_asset_id: assetId,
        action_type: action.action_type,
        target_type: action.target_type,
        payload: action.payload,
        approval_state: 'draft',
        sync_state: 'draft',
        sync_target: 'iris_direct',
        idempotency_key: crypto.createHash('sha256')
          .update(`${runId}:${assetId}:${action.action_type}:${JSON.stringify(action.payload)}`)
          .digest('hex'),
        external_ref: null,
        error_message: null,
        summary: action.summary,
        blocking_flags: action.blocking_flags,
        created_at: createdAt,
        updated_at: createdAt,
      };

      return record;
    });

    if (records.length === 0) {
      return [];
    }

    // La tabla usa payload_json/blocking_flags_json; los campos TS `payload` y
    // `blocking_flags` NO deben viajar en el insert (PostgREST los rechaza).
    const { error } = await supabase
      .from('meeting_sync_actions')
      .insert(
        records.map(({ payload, blocking_flags, ...columns }) => ({
          ...columns,
          payload_json: payload,
          blocking_flags_json: blocking_flags ?? [],
        })),
      );

    throwOnError(error, 'replaceSyncActions.insert');
    return records;
  }
