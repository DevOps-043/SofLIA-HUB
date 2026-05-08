import type { ChatSpace } from '../gchat-service';
import type {
  MeetingContextProject,
  MeetingContextTeam,
  MeetingContextTeamMember,
} from '../meeting-service';
import type { WorkflowCaseSummary } from './cases';
import type {
  PassiveWorkflowRule,
  WorkflowDefinition,
  WorkflowVariant,
  WorkspaceCapabilityStatus,
} from './definitions';

export interface WorkflowHubOverview {
  workflows: WorkflowDefinition[];
  variants: WorkflowVariant[];
  passiveRules: PassiveWorkflowRule[];
  cases: WorkflowCaseSummary[];
  capabilities: WorkspaceCapabilityStatus[];
  gchatSpaces: ChatSpace[];
  meetingContext: {
    teams: MeetingContextTeam[];
    projects: MeetingContextProject[];
    teamMembers: MeetingContextTeamMember[];
  };
  legacyCustomTemplates: Array<{
    id: string;
    name: string;
    description: string;
    createdAt?: string;
  }>;
}
