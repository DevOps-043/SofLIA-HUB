import { getNextIssueNumber } from './issues';
import { MAX_ISSUE_NUMBER_RETRIES } from './operations-write-types';
import type { CreateIssueParams, CreateIssueResult, IssueWriteContext } from './operations-write-types';

export function buildIssueInsertBase(
  params: CreateIssueParams,
  title: string,
  context: IssueWriteContext,
): Record<string, unknown> {
  const insertBase: Record<string, unknown> = {
    team_id: context.effectiveTeam.team_id,
    title,
    creator_id: params.creatorId,
    status_id: context.status.status_id,
  };
  if (context.priority?.priority_id) insertBase.priority_id = context.priority.priority_id;
  if (context.resolvedProject?.project_id) insertBase.project_id = context.resolvedProject.project_id;
  if (context.assignee?.user_id) insertBase.assignee_id = context.assignee.user_id;
  if (params.description?.trim()) insertBase.description = params.description.trim();
  if (params.dueDate?.trim()) insertBase.due_date = params.dueDate.trim();
  return insertBase;
}

export async function insertIssueWithRetry(
  iris: any,
  teamId: string,
  insertBase: Record<string, unknown>,
  warnings: string[],
): Promise<CreateIssueResult> {
  let lastError: { code?: string; message?: string; details?: string } | null = null;
  let collisionWarningAdded = false;

  for (let attempt = 1; attempt <= MAX_ISSUE_NUMBER_RETRIES; attempt += 1) {
    const issueNumber = await getNextIssueNumber(teamId);
    const { data, error } = await iris
      .from('task_issues')
      .insert({ ...insertBase, issue_number: issueNumber })
      .select('*, status:task_statuses(*), priority:task_priorities(*)')
      .single();

    if (!error) {
      console.log(`[IRIS-Main] Issue created: #${data.issue_number} "${data.title}"`);
      return { success: true, issue: data, warnings: warnings.length > 0 ? warnings : undefined };
    }

    lastError = error;
    if (isDuplicateIssueNumber(error) && attempt < MAX_ISSUE_NUMBER_RETRIES) {
      if (!collisionWarningAdded) {
        warnings.push('Hubo una colision temporal al asignar el numero de issue y se reintento la creacion.');
        collisionWarningAdded = true;
      }
      continue;
    }

    console.error('[IRIS-Main] createIssue error:', error);
    return { success: false, error: error.message, warnings: warnings.length > 0 ? warnings : undefined };
  }

  return {
    success: false,
    error: lastError?.message || 'No se pudo crear la tarea en IRIS.',
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

function isDuplicateIssueNumber(error: { code?: string; message?: string; details?: string }): boolean {
  return error.code === '23505' && `${error.message || ''} ${error.details || ''}`.toLowerCase().includes('issue_number');
}
