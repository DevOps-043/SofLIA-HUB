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
