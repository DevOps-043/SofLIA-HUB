import { updateIssueStatus } from '../../iris-data-main';
import type { SyncActionContext, SyncActionDetail } from './types';

export async function syncUpdateTaskStatusAction({
  store,
  action,
}: SyncActionContext): Promise<SyncActionDetail> {
  const updateResult = await updateIssueStatus({
    issueId: action.payload.issue_id,
    teamId: action.payload.team_id,
    newStatusName: action.payload.new_status_name,
  });

  if (!updateResult.success) {
    const message = updateResult.error || 'No se pudo actualizar la tarea.';
    await store.updateActionSyncState(action.id, 'failed', null, message);
    return { action_id: action.id, status: 'failed', message };
  }

  await store.updateActionSyncState(action.id, 'synced', action.payload.issue_id || null, null);
  return {
    action_id: action.id,
    status: 'synced',
    message: 'Estado de tarea actualizado en IRIS.',
  };
}
