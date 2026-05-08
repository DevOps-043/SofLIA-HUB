import type { MeetingOriginChannel } from '../meeting-types';

export interface BaseCreateMeetingRunInput {
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
}

export interface CreateManualMeetingRunInput extends BaseCreateMeetingRunInput {
  text: string;
}

export interface CreateDriveMeetingRunInput extends BaseCreateMeetingRunInput {
  fileIdOrUrl: string;
}
