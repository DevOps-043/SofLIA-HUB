import { irisSupa, isIrisConfigured } from '../../lib/iris-client';
import { sofiaAuth } from '../sofia-auth';
import { resolveAssigneeReference } from './assignee-resolution';
import { insertIssueWithRetry } from './create-issue-insert';
import { resolveIssueTeam } from './create-issue-team';
import { resolvePriorityReference, resolveStatusReference } from './metadata';
import type { IrisIssue, MutationResult } from './types';
import { ensureUserExistsInIris } from './user-sync';

export async function createIrisIssue(data: {
  title: string;
  description?: string;
  team_id?: string;
  team_name?: string;
  project_id?: string;
  project_name?: string;
  priority_id?: string;
  priority_name?: string;
  status_id?: string;
  status_name?: string;
  assignee_id?: string;
  assignee_name?: string;
  assignee_query?: string;
}): Promise<MutationResult<IrisIssue>> {
  try {
    if (!irisSupa || !isIrisConfigured()) return { success: false, error: 'Database not configured' };
    const title = data.title?.trim();
    if (!title) return { success: false, error: 'La tarea necesita un titulo valido.' };

    const session = await sofiaAuth.getSession();
    let userId = session?.user?.id;
    if (!userId) userId = (await irisSupa.auth.getUser()).data.user?.id;
    if (!userId) return { success: false, error: 'Usuario no autenticado' };

    const warnings: string[] = [];
    const teamResult = await resolveIssueTeam({ ...data, warnings });
    if (!teamResult.success) return { success: false, error: teamResult.error, warnings: warnings.length ? warnings : undefined };

    const effectiveTeam = teamResult.data!.team;
    const project = teamResult.data!.project;
    const statusResult = await resolveStatusReference({ statusId: data.status_id, statusName: data.status_name, teamId: effectiveTeam.team_id });
    if (!statusResult.success) return { success: false, error: statusResult.error, warnings: warnings.length ? warnings : undefined };
    const priorityResult = await resolvePriorityReference({ priorityId: data.priority_id, priorityName: data.priority_name });
    if (!priorityResult.success) return { success: false, error: priorityResult.error, warnings: warnings.length ? warnings : undefined };
    const assigneeResult = await resolveAssigneeReference({
      assigneeId: data.assignee_id,
      assigneeQuery: data.assignee_name || data.assignee_query,
      teamId: effectiveTeam.team_id,
    });
    if (!assigneeResult.success) return { success: false, error: assigneeResult.error, warnings: warnings.length ? warnings : undefined };

    await ensureUserExistsInIris(userId);
    if (assigneeResult.value?.user_id && assigneeResult.value.user_id !== userId) await ensureUserExistsInIris(assigneeResult.value.user_id);

    return insertIssueWithRetry(
      {
        title,
        description: data.description?.trim() || '',
        team_id: effectiveTeam.team_id,
        project_id: project?.project_id || null,
        priority_id: priorityResult.value?.priority_id || null,
        status_id: statusResult.value.status_id,
        assignee_id: assigneeResult.value?.user_id || null,
        creator_id: userId,
      },
      effectiveTeam.team_id,
      warnings,
    );
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
