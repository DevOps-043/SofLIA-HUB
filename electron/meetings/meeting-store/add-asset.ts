import type { MeetingStore } from '../meeting-store.ts';
import { getMeetingIrisClient } from '../meeting-iris-client';
import type { MeetingAssetPayload, MeetingAssetRecord } from '../meeting-types';
import { nowIso, makeId, throwOnError } from './shared';

export async function addAsset(this: MeetingStore, runId: string, payload: MeetingAssetPayload, confidence: number | null): Promise<MeetingAssetRecord> {
    const supabase = getMeetingIrisClient();
    const { data: versions, error: versionError } = await supabase
      .from('meeting_assets')
      .select('asset_version')
      .eq('meeting_run_id', runId)
      .order('asset_version', { ascending: false })
      .limit(1);

    throwOnError(versionError, 'addAsset.selectVersion');
    const assetVersion = versions?.[0]?.asset_version ? Number(versions[0].asset_version) + 1 : 1;

    const record: MeetingAssetRecord = {
      id: makeId('masset'),
      meeting_run_id: runId,
      schema_version: payload.schema_version,
      asset_version: assetVersion,
      payload,
      executive_summary: payload.executive_summary,
      operational_summary: payload.operational_summary,
      review_flags: payload.review_flags,
      confidence,
      created_at: nowIso(),
    };

    const { error } = await supabase
      .from('meeting_assets')
      .insert({
        ...record,
        payload_json: record.payload,
        review_flags_json: record.review_flags,
      });

    throwOnError(error, 'addAsset.insert');
    return record;
  }
