import type { MeetingCommitment } from './core';
import type {
  MeetingApprovalRecord,
  MeetingAssetRecord,
  MeetingRunRecord,
  MeetingSourceArtifactRecord,
  MeetingSyncActionRecord,
} from './records';
import type { PreparedMeetingSource } from './records';

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
  originChannel: MeetingRunRecord['origin_channel'];
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
