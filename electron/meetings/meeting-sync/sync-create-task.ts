import { createIssue } from '../../iris-data-main';
import { resolveCreatorUserId } from './creator';
import type { SyncActionContext, SyncActionDetail } from './types';

export async function syncCreateTaskAction({
  store,
  action,
  ownerUserId,
}: SyncActionContext): Promise<SyncActionDetail> {
  if (!action.payload.team_id) {
    await store.updateActionSyncState(action.id, 'failed', null, 'Falta team_id para crear la tarea.');
    return { action_id: action.id, status: 'failed', message: 'Falta team_id para crear la tarea.' };
  }

  const creatorUserId = action.payload.creator_user_id || resolveCreatorUserId(ownerUserId) || action.payload.assignee_id;
  if (!creatorUserId) {
    const message = 'No pude resolver un creator_user_id valido para crear la tarea en IRIS.';
    await store.updateActionSyncState(action.id, 'failed', null, message);
    return { action_id: action.id, status: 'failed', message };
  }

  const issueResult = await createIssue({
    teamId: action.payload.team_id,
    title: action.payload.title || action.summary,
    creatorId: creatorUserId,
    projectId: action.payload.project_id,
    assigneeId: action.payload.assignee_id || undefined,
    description: action.payload.description,
    dueDate: action.payload.due_date || undefined,
  });

  if (!issueResult.success || !issueResult.issue) {
    const message = issueResult.error || 'No se pudo crear la tarea.';
    await store.updateActionSyncState(action.id, 'failed', null, message);
    return { action_id: action.id, status: 'failed', message };
  }

  const externalRef =
    issueResult.issue.issue_id ||
    issueResult.issue.id ||
    issueResult.issue.task_issue_id ||
    null;

  await store.updateActionSyncState(action.id, 'synced', externalRef, null);
  return { action_id: action.id, status: 'synced', message: 'Tarea creada en IRIS.' };
}
