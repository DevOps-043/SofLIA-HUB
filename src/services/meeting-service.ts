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
  }>;
  latest_asset: {
    id: string;
    payload: {
      executive_summary: string;
      operational_summary: string;
      decisions: Array<{ statement: string }>;
      commitments: Array<{ statement: string; owner_candidate?: string | null; due_date_candidate?: string | null; status: string }>;
      issues: Array<{ statement: string; severity: string }>;
      review_flags: Array<{ code: string; message: string }>;
      proposed_actions: Array<{ summary: string }>;
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

export interface MeetingContextTeam {
  team_id: string;
  name: string;
}

export interface MeetingContextProject {
  project_id: string;
  project_name: string;
  team_id?: string | null;
}

export interface MeetingContextTeamMember {
  membership_id: string;
  team_id: string;
  user_id: string;
  role: string;
  joined_at: string;
  display_name?: string | null;
  email?: string | null;
  username?: string | null;
}

export interface MeetingDetectedEvent {
  runId: string;
  ownerUserId: string;
  meetingTitle: string | null;
  sourceFileName: string | null;
}

declare global {
  interface Window {
    meeting: {
      listRuns: (filters?: { ownerUserId?: string; limit?: number }) => Promise<{ success: boolean; runs?: MeetingRunSummary[]; error?: string }>;
      getRunDetail: (runId: string) => Promise<{ success: boolean; detail?: MeetingRunDetail; error?: string }>;
      createManualRun: (input: any) => Promise<{ success: boolean; result?: { detail: MeetingRunDetail; deduplicated: boolean }; error?: string }>;
      createDriveRun: (input: any) => Promise<{ success: boolean; result?: { detail: MeetingRunDetail; deduplicated: boolean }; error?: string }>;
      approveAsset: (input: any) => Promise<{ success: boolean; detail?: MeetingRunDetail; error?: string }>;
      approveActions: (input: any) => Promise<{ success: boolean; detail?: MeetingRunDetail; error?: string }>;
      updateAction: (input: any) => Promise<{ success: boolean; detail?: MeetingRunDetail; error?: string }>;
      rejectAction: (input: any) => Promise<{ success: boolean; detail?: MeetingRunDetail; error?: string }>;
      syncApprovedActions: (input: any) => Promise<{ success: boolean; detail?: MeetingRunDetail; result?: { synced: number; failed: number; skipped: number }; error?: string }>;
      getFollowups: (ownerUserId?: string) => Promise<{ success: boolean; followups?: any[]; error?: string }>;
      getContext: () => Promise<{
        success: boolean;
        teams?: MeetingContextTeam[];
        projects?: MeetingContextProject[];
        teamMembers?: MeetingContextTeamMember[];
        error?: string;
      }>;
      onDetected?: (cb: (payload: MeetingDetectedEvent) => void) => void;
      removeListeners?: () => void;
    };
  }
}

export function listMeetingRuns(filters?: { ownerUserId?: string; limit?: number }) {
  return window.meeting.listRuns(filters);
}

export function getMeetingRunDetail(runId: string) {
  return window.meeting.getRunDetail(runId);
}

export function createManualMeetingRun(input: any) {
  return window.meeting.createManualRun(input);
}

export function createDriveMeetingRun(input: any) {
  return window.meeting.createDriveRun(input);
}

export function approveMeetingAsset(input: any) {
  return window.meeting.approveAsset(input);
}

export function approveMeetingActions(input: any) {
  return window.meeting.approveActions(input);
}

export function updateMeetingAction(input: any) {
  return window.meeting.updateAction(input);
}

export function rejectMeetingAction(input: any) {
  return window.meeting.rejectAction(input);
}

export function syncApprovedMeetingActions(input: any) {
  return window.meeting.syncApprovedActions(input);
}

export function getMeetingFollowups(ownerUserId?: string) {
  return window.meeting.getFollowups(ownerUserId);
}

export function getMeetingContext() {
  return window.meeting.getContext();
}

export function onMeetingDetected(cb: (payload: MeetingDetectedEvent) => void) {
  window.meeting.onDetected?.(cb);
}

export function removeMeetingListeners() {
  window.meeting.removeListeners?.();
}
