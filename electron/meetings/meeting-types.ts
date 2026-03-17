export type MeetingOriginChannel = 'app' | 'whatsapp' | 'system';

export type MeetingRunStatus =
  | 'SOURCE_IMPORTED'
  | 'EXTRACTING'
  | 'REVIEW_REQUIRED'
  | 'APPROVED'
  | 'SYNCING'
  | 'SYNCED'
  | 'FOLLOWUP_ACTIVE'
  | 'CLOSED'
  | 'FAILED_IMPORT'
  | 'FAILED_EXTRACTION'
  | 'BLOCKED_REVIEW'
  | 'SYNC_FAILED';

export type MeetingSyncActionState = 'draft' | 'approved' | 'rejected' | 'synced' | 'failed';

export type MeetingSyncTarget = 'iris_direct' | 'bridge';

export type MeetingSourceAuthority =
  | 'user_provided'
  | 'workspace_generated'
  | 'google_workspace'
  | 'approved_external';

export type MeetingReviewFlagCode =
  | 'missing_owner'
  | 'missing_due_date'
  | 'missing_evidence'
  | 'ambiguous_speaker'
  | 'missing_project_target'
  | 'low_confidence';

export interface MeetingParticipant {
  display_name: string;
  email?: string | null;
  external?: boolean;
  confidence?: number | null;
}

export interface MeetingEvidenceRef {
  source_artifact_id?: string;
  excerpt?: string;
}

export interface MeetingDecision {
  statement: string;
  owner_candidate?: string | null;
  approval_state?: 'proposed' | 'approved' | 'rejected' | 'needs_review';
  evidence_refs: MeetingEvidenceRef[];
  confidence?: number | null;
}

export interface MeetingCommitment {
  statement: string;
  owner_candidate?: string | null;
  due_date_candidate?: string | null;
  status: 'open' | 'at_risk' | 'blocked' | 'resolved' | 'needs_clarification';
  project_target?: string | null;
  evidence_refs: MeetingEvidenceRef[];
  confidence?: number | null;
}

export interface MeetingIssue {
  statement: string;
  severity: 'low' | 'medium' | 'high';
  owner_candidate?: string | null;
  evidence_refs: MeetingEvidenceRef[];
  confidence?: number | null;
}

export interface MeetingOpenQuestion {
  question: string;
  owner_candidate?: string | null;
  evidence_refs: MeetingEvidenceRef[];
}

export interface MeetingParkingLotItem {
  statement: string;
  evidence_refs: MeetingEvidenceRef[];
}

export interface MeetingReviewFlag {
  code: MeetingReviewFlagCode;
  message: string;
  entity_type?: 'decision' | 'commitment' | 'issue' | 'action';
  entity_index?: number;
}

export interface MeetingSyncActionPayload {
  title?: string;
  description?: string;
  team_id?: string;
  project_id?: string;
  due_date?: string | null;
  owner_candidate?: string | null;
  assignee_id?: string | null;
  creator_user_id?: string;
  issue_id?: string;
  new_status_name?: string;
  project_id_to_update?: string;
  new_project_status?: string;
  source_commitment_index?: number;
}

export interface UpdateMeetingActionInput {
  summary?: string;
  title?: string;
  description?: string;
  team_id?: string | null;
  project_id?: string | null;
  due_date?: string | null;
  owner_candidate?: string | null;
  assignee_id?: string | null;
}

export interface ProposedMeetingAction {
  action_type: 'create_task' | 'update_task_status' | 'update_project_status';
  target_type: 'task_issue' | 'project';
  summary: string;
  payload: MeetingSyncActionPayload;
  requires_approval: boolean;
  blocking_flags: MeetingReviewFlagCode[];
}

export interface MeetingAssetPayload {
  schema_version: 'meeting_asset.v1';
  meeting_run_id?: string;
  trace_id: string;
  meeting_title: string;
  meeting_type: string;
  source_refs: Array<{ source_artifact_id?: string; source_type?: string; source_uri?: string | null }>;
  participants: MeetingParticipant[];
  decisions: MeetingDecision[];
  commitments: MeetingCommitment[];
  issues: MeetingIssue[];
  open_questions: MeetingOpenQuestion[];
  parking_lot: MeetingParkingLotItem[];
  executive_summary: string;
  operational_summary: string;
  review_flags: MeetingReviewFlag[];
  proposed_actions: ProposedMeetingAction[];
  continuity_context: string[];
}

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

export interface MeetingRunDetail {
  run: MeetingRunRecord;
  source_artifacts: MeetingSourceArtifactRecord[];
  latest_asset: MeetingAssetRecord | null;
  sync_actions: MeetingSyncActionRecord[];
  approvals: MeetingApprovalRecord[];
}

export interface MeetingRunSummary {
  run: MeetingRunRecord;
  latest_asset: Pick<MeetingAssetRecord, 'id' | 'executive_summary' | 'operational_summary' | 'review_flags' | 'created_at'> | null;
  counts: {
    draft_actions: number;
    approved_actions: number;
    synced_actions: number;
    failed_actions: number;
  };
}

export interface CreateMeetingRunInput {
  organizationId?: string | null;
  workspaceId?: string | null;
  ownerUserId: string;
  originChannel: MeetingOriginChannel;
  originRef?: string | null;
  meetingTitle?: string | null;
  meetingType?: string;
  meetingSeriesKey?: string | null;
  defaultTeamId?: string | null;
  defaultProjectId?: string | null;
  source: PreparedMeetingSource;
}

export interface CreateMeetingRunResult {
  detail: MeetingRunDetail;
  deduplicated: boolean;
}

export interface MeetingFollowupItem {
  run_id: string;
  meeting_title: string | null;
  owner_user_id: string;
  commitment: MeetingCommitment;
  assignee_id?: string | null;
  due_in_hours: number | null;
  status: 'upcoming' | 'overdue' | 'open';
}

export interface MeetingSyncExecutionResult {
  synced: number;
  failed: number;
  skipped: number;
  details: Array<{
    action_id: string;
    status: 'synced' | 'failed' | 'skipped';
    message: string;
  }>;
}
