import type {
  MeetingOriginChannel,
  MeetingReviewFlag,
  MeetingReviewFlagCode,
  MeetingRunStatus,
  MeetingSourceAuthority,
  MeetingSyncActionState,
  MeetingSyncTarget,
} from './core';
import type { MeetingAssetPayload, MeetingSyncActionPayload, ProposedMeetingAction } from './actions';

export interface PreparedMeetingSource {
  source_system: string;
  source_type: string;
  source_uri?: string | null;
  external_file_id?: string | null;
  mime_type?: string | null;
  authority_level: MeetingSourceAuthority;
  normalized_text: string;
  content_hash: string;
  metadata: Record<string, unknown>;
}

export interface MeetingRunRecord {
  id: string;
  organization_id: string | null;
  workspace_id: string | null;
  owner_user_id: string;
  origin_channel: MeetingOriginChannel;
  origin_ref: string | null;
  meeting_title: string | null;
  meeting_type: string;
  meeting_series_key: string | null;
  primary_source_uri: string | null;
  status: MeetingRunStatus;
  source_hash: string;
  source_version: number;
  trace_id: string;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface MeetingSourceArtifactRecord {
  id: string;
  meeting_run_id: string;
  source_system: string;
  source_type: string;
  source_uri: string | null;
  external_file_id: string | null;
  mime_type: string | null;
  authority_level: MeetingSourceAuthority;
  sha256: string;
  normalized_text: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface MeetingAssetRecord {
  id: string;
  meeting_run_id: string;
  schema_version: string;
  asset_version: number;
  payload: MeetingAssetPayload;
  executive_summary: string;
  operational_summary: string;
  review_flags: MeetingReviewFlag[];
  confidence: number | null;
  created_at: string;
}

export interface MeetingSyncActionRecord {
  id: string;
  meeting_run_id: string;
  meeting_asset_id: string;
  action_type: ProposedMeetingAction['action_type'];
  target_type: ProposedMeetingAction['target_type'];
  payload: MeetingSyncActionPayload;
  approval_state: MeetingSyncActionState;
  sync_state: MeetingSyncActionState;
  sync_target: MeetingSyncTarget;
  idempotency_key: string;
  external_ref: string | null;
  error_message: string | null;
  summary: string;
  blocking_flags: MeetingReviewFlagCode[];
  created_at: string;
  updated_at: string;
}

export interface MeetingApprovalRecord {
  id: string;
  meeting_run_id: string;
  scope: 'asset' | 'actions' | 'action';
  scope_ref_id: string | null;
  requested_by_user_id: string;
  decided_by_user_id: string | null;
  decision: 'pending' | 'approved' | 'rejected';
  comment: string | null;
  created_at: string;
  decided_at: string | null;
}
