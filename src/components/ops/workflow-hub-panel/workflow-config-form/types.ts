import type {
  WorkflowDefinition,
  WorkflowHubOverview,
} from '../../../../services/workflow-hub-service';

export interface WorkflowConfigFormProps {
  workflow: WorkflowDefinition;
  draftConfig: Record<string, unknown>;
  inputClass: string;
  textareaClass: string;
  gchatSpaces: WorkflowHubOverview['gchatSpaces'];
  teams: WorkflowHubOverview['meetingContext']['teams'];
  getProjectsForTeam: (teamId: string) => WorkflowHubOverview['meetingContext']['projects'];
  updateConfig: (key: string, value: unknown) => void;
}

export type WorkflowConfigSectionProps = Omit<WorkflowConfigFormProps, 'workflow'>;
