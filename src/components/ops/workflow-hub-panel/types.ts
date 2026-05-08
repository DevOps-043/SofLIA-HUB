export interface WorkflowHubPanelProps {
  userId: string;
  organizationId?: string | null;
}

export type ActionDraft = {
  title: string;
  dueDate: string;
  teamId: string;
  projectId: string;
  assigneeId: string;
};

export type PassiveScheduleFrequency = 'daily' | 'weekdays' | 'weekly';
