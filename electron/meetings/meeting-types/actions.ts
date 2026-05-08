import type {
  MeetingCommitment,
  MeetingDecision,
  MeetingIssue,
  MeetingOpenQuestion,
  MeetingParkingLotItem,
  MeetingParticipant,
  MeetingReviewFlag,
  MeetingReviewFlagCode,
} from './core';
import type { MeetingAnalysisResult } from './analysis-result';

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
  analysis_result?: MeetingAnalysisResult | null;
}
