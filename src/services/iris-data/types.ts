import type { IrisIssue, IrisPriority, IrisProject, IrisStatus, IrisTeam } from '../../lib/iris-client';

export type { IrisIssue, IrisPriority, IrisProject, IrisStatus, IrisTeam };

export interface IrisTeamMember {
  member_id: string;
  membership_id?: string;
  team_id: string;
  user_id: string;
  role: string;
  joined_at: string;
  is_active?: boolean;
}

export interface IrisTeamMemberDetail extends IrisTeamMember {
  display_name?: string | null;
  email?: string | null;
  username?: string | null;
}

export type ResolveResult<T> =
  | { success: true; value: T; warnings: string[] }
  | { success: false; error: string };

export type MutationResult<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
  warnings?: string[];
};
