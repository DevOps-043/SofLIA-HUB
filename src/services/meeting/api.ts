import type {
  MeetingContextProject,
  MeetingContextTeam,
  MeetingContextTeamMember,
  MeetingDetectedEvent,
} from './context';
import type { MeetingRunDetail } from './detail';
import type { MeetingRunSummary } from './summaries';

declare global {
  interface Window {
    meeting: {
      listRuns: (filters?: { ownerUserId?: string; organizationId?: string; limit?: number }) => Promise<{ success: boolean; runs?: MeetingRunSummary[]; error?: string }>;
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

export function listMeetingRuns(filters?: { ownerUserId?: string; organizationId?: string; limit?: number }) {
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
