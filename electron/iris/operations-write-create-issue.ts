import { getIrisClient } from './clients';
import { resolveIssueWriteContext } from './operations-write-issue-context';
import { buildIssueInsertBase, insertIssueWithRetry } from './operations-write-issue-insert';
import type { CreateIssueParams, CreateIssueResult } from './operations-write-types';
import { ensureUserExistsInIris } from './user-sync';

export async function createIssue(params: CreateIssueParams): Promise<CreateIssueResult> {
  const iris = getIrisClient();
  if (!iris) return { success: false, error: 'IRIS no esta disponible.' };

  try {
    const title = params.title?.trim();
    if (!title) return { success: false, error: 'La tarea necesita un titulo valido.' };

    const contextResult = await resolveIssueWriteContext(params);
    if (!contextResult.success) return contextResult;

    await ensureIssueUsers(params.creatorId, contextResult.value.assignee?.user_id);
    const insertBase = buildIssueInsertBase(params, title, contextResult.value);
    return insertIssueWithRetry(
      iris,
      contextResult.value.effectiveTeam.team_id,
      insertBase,
      contextResult.value.warnings,
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[IRIS-Main] createIssue exception:', err);
    return { success: false, error: message };
  }
}

async function ensureIssueUsers(creatorId: string, assigneeId?: string): Promise<void> {
  await ensureUserExistsInIris(creatorId);
  if (assigneeId && assigneeId !== creatorId) await ensureUserExistsInIris(assigneeId);
}
