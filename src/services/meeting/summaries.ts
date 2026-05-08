export interface MeetingRunSummary {
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
  latest_asset: {
    id: string;
    executive_summary: string;
    operational_summary: string;
    review_flags: Array<{ code: string; message: string; entity_type?: string; entity_index?: number }>;
    created_at: string;
  } | null;
  counts: {
    draft_actions: number;
    approved_actions: number;
    synced_actions: number;
    failed_actions: number;
  };
}
