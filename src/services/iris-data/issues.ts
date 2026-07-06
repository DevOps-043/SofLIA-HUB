import { irisSupa, isIrisConfigured } from '../../lib/iris-client';
import type { IrisIssue } from './types';

export async function getIssues(filters?: {
  teamId?: string;
  teamIds?: string[];
  projectId?: string;
  assigneeId?: string;
  limit?: number;
}): Promise<IrisIssue[]> {
  try {
    if (!irisSupa || !isIrisConfigured()) return [];
    if (filters?.teamIds && filters.teamIds.length === 0) return [];
    let query = irisSupa
      .from('task_issues')
      .select('*, status:task_statuses(*), priority:task_priorities(*)')
      .is('archived_at', null)
      .order('updated_at', { ascending: false });
    if (filters?.teamId) query = query.eq('team_id', filters.teamId);
    else if (filters?.teamIds) query = query.in('team_id', filters.teamIds);
    if (filters?.projectId) query = query.eq('project_id', filters.projectId);
    if (filters?.assigneeId) query = query.eq('assignee_id', filters.assigneeId);
    const { data, error } = await query.limit(filters?.limit || 20);
    return error ? [] : ((data || []) as IrisIssue[]);
  } catch {
    return [];
  }
}

export async function getNextIssueNumber(teamId: string): Promise<number> {
  if (!irisSupa || !isIrisConfigured()) return 1;
  const { data } = await irisSupa
    .from('task_issues')
    .select('issue_number')
    .eq('team_id', teamId)
    .order('issue_number', { ascending: false })
    .limit(1);
  return data && data.length > 0 ? data[0].issue_number + 1 : 1;
}
