import type {
  MeetingContextProject,
  MeetingContextTeamMember,
  MeetingRunDetail,
} from '../../../services/meeting-service';
import type { ActionDraft } from './types';

const EMPTY_ACTION_DRAFT: ActionDraft = {
  title: '',
  dueDate: '',
  teamId: '',
  projectId: '',
  assigneeId: '',
  existingIssueId: '',
};

export function buildActionDrafts(detail: MeetingRunDetail | null): Record<string, ActionDraft> {
  if (!detail) return {};

  const nextDrafts: Record<string, ActionDraft> = {};
  for (const action of detail.sync_actions) {
    nextDrafts[action.id] = {
      title: action.payload.title || action.summary || '',
      dueDate: action.payload.due_date || '',
      teamId: action.payload.team_id || '',
      projectId: action.payload.project_id || '',
      assigneeId: action.payload.assignee_id || '',
      existingIssueId: action.payload.issue_id || '',
    };
  }
  return nextDrafts;
}

export function patchActionDraft(
  current: Record<string, ActionDraft>,
  actionId: string,
  patch: Partial<ActionDraft>,
): Record<string, ActionDraft> {
  return {
    ...current,
    [actionId]: { ...(current[actionId] || EMPTY_ACTION_DRAFT), ...patch },
  };
}

export function filterProjectsByTeam(projects: MeetingContextProject[], teamId: string): MeetingContextProject[] {
  if (!teamId) return projects;
  return projects.filter((project) => !project.team_id || project.team_id === teamId);
}

export function filterMembersByTeam(members: MeetingContextTeamMember[], teamId: string): MeetingContextTeamMember[] {
  if (!teamId) return [];
  return members.filter((member) => member.team_id === teamId);
}
