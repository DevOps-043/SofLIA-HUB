import type { MeetingStore } from '../meeting-store.ts';
import type { MeetingAssetPayload, MeetingAssetRecord, MeetingReviewFlag } from '../meeting-types';
import { parseJson } from './shared';

export function mapAsset(this: MeetingStore, row: any): MeetingAssetRecord {
    const payload = parseJson<MeetingAssetPayload>(row.payload_json, {
      schema_version: 'meeting_asset.v1',
      trace_id: '',
      meeting_title: '',
      meeting_type: 'general',
      source_refs: [],
      participants: [],
      decisions: [],
      commitments: [],
      issues: [],
      open_questions: [],
      parking_lot: [],
      executive_summary: '',
      operational_summary: '',
      review_flags: [],
      proposed_actions: [],
      continuity_context: [],
    });

    return {
      id: row.id,
      meeting_run_id: row.meeting_run_id,
      schema_version: row.schema_version,
      asset_version: Number(row.asset_version),
      payload,
      executive_summary: row.executive_summary || payload.executive_summary || '',
      operational_summary: row.operational_summary || payload.operational_summary || '',
      review_flags: parseJson<MeetingReviewFlag[]>(row.review_flags_json, []),
      confidence: row.confidence === null || row.confidence === undefined ? null : Number(row.confidence),
      created_at: row.created_at,
    };
  }
