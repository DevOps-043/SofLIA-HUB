import type { ChatSpace } from '../gchat-service';

import type { WorkflowCaseSummary } from './case-types';
import type { WorkflowDefinition, WorkflowVariant, WorkspaceCapabilityStatus } from './core-types';
import type { MeetingContextProject, MeetingContextTeam, MeetingContextTeamMember } from './meeting-context-types';
import type { PassiveWorkflowRule } from './passive-rule-types';

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
