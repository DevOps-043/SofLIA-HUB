import type { IrisTeam } from './types';

export const MAX_ISSUE_NUMBER_RETRIES = 3;

export interface CreateIssueParams {
  teamId?: string;
  teamName?: string;
  title: string;
  creatorId: string;
  statusId?: string;
  statusName?: string;
  priorityId?: string;
  priorityName?: string;
  projectId?: string;
  projectName?: string;
  assigneeId?: string;
  assigneeQuery?: string;
  description?: string;
  dueDate?: string;
}

export interface CreateIssueResult {
  success: boolean;
  issue?: any;
  error?: string;
  warnings?: string[];
}

export interface IssueWriteContext {
  effectiveTeam: IrisTeam;
  resolvedProject: { project_id?: string; project_name?: string; team_id?: string } | null;
  status: { status_id: string };
  priority: { priority_id?: string } | null;
  assignee: { user_id?: string } | null;
  warnings: string[];
}

export type IssueContextResult =
  | { success: true; value: IssueWriteContext }
  | { success: false; error: string; warnings?: string[] };
