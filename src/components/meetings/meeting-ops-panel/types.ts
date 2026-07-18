export interface MeetingOpsPanelProps {
  userId: string;
  organizationId?: string | null;
  /** Todas las identidades del usuario (uid de Lia + id de SOFIA) para listar sus runs. */
  accessUserIds?: string[];
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
