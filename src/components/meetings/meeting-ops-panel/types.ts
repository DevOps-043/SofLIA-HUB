export interface MeetingOpsPanelProps {
  userId: string;
  organizationId?: string | null;
}

export type CreateMode = 'manual' | 'drive';

export type ActionDraft = {
  title: string;
  dueDate: string;
  teamId: string;
  projectId: string;
  assigneeId: string;
};

export interface MeetingOpsForm {
  meetingTitle: string;
  meetingType: string;
  defaultTeamId: string;
  defaultProjectId: string;
  manualText: string;
  driveRef: string;
}
