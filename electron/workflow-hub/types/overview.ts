import type { ChatSpace } from '../../gchat-service';
import type { WorkflowCaseSummary } from './cases';
import type {
  PassiveWorkflowRule,
  WorkflowDefinition,
  WorkflowVariant,
  WorkspaceCapabilityStatus,
} from './definitions';

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
  membership_id?: string;
  team_id: string;
  user_id: string;
  role: string;
  joined_at: string;
  display_name?: string | null;
  email?: string | null;
  username?: string | null;
}

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
