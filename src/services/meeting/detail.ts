import type { MeetingAnalysisResult } from './analysis';

export interface MeetingRunDetail {
  run: {
    id: string;
    owner_user_id: string;
    meeting_title: string | null;
    meeting_type: string;
    primary_source_uri?: string | null;
    status: string;
    created_at: string;
    updated_at: string;
  };
  source_artifacts: Array<{
    id: string;
    source_system: string;
    source_type: string;
    source_uri: string | null;
    /** Texto completo de la fuente (transcripcion normalizada). */
    normalized_text?: string | null;
    sha256?: string;
    created_at?: string;
  }>;
  latest_asset: {
    id: string;
    payload: {
      executive_summary: string;
      operational_summary: string;
      decisions: Array<{ statement: string }>;
      commitments: Array<{
        statement: string;
        owner_candidate?: string | null;
        due_date_candidate?: string | null;
        status: string;
      }>;
      issues: Array<{ statement: string; severity: string }>;
      review_flags: Array<{ code: string; message: string }>;
      proposed_actions: Array<{ summary: string }>;
      analysis_result?: MeetingAnalysisResult | null;
    };
    executive_summary: string;
    operational_summary: string;
    review_flags: Array<{ code: string; message: string; entity_type?: string; entity_index?: number }>;
  } | null;
  sync_actions: Array<{
    id: string;
    action_type: string;
    summary: string;
    approval_state: string;
    sync_state: string;
    error_message: string | null;
    blocking_flags: string[];
    payload: {
      title?: string;
      description?: string;
      team_id?: string;
      project_id?: string;
      due_date?: string | null;
      owner_candidate?: string | null;
      assignee_id?: string | null;
      issue_id?: string | null;
    };
  }>;
  approvals: Array<{
    id: string;
    scope: string;
    decision: string;
    comment: string | null;
    created_at: string;
  }>;
}
