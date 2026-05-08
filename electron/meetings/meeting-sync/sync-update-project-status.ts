import { updateProjectStatus } from '../../iris-data-main';
import type { SyncActionContext, SyncActionDetail } from './types';

type IrisProjectStatus = 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled' | 'archived';

export async function syncUpdateProjectStatusAction({
  store,
  action,
}: SyncActionContext): Promise<SyncActionDetail> {
  const projectId = action.payload.project_id_to_update || action.payload.project_id;
  const newStatus = action.payload.new_project_status;

  if (!projectId || !newStatus) {
    const message = 'Faltan datos para actualizar el proyecto.';
    await store.updateActionSyncState(action.id, 'failed', null, message);
    return { action_id: action.id, status: 'failed', message };
  }

  const updateResult = await updateProjectStatus({
    projectId,
    newStatus: newStatus as IrisProjectStatus,
  });

  if (!updateResult.success) {
    const message = updateResult.error || 'No se pudo actualizar el proyecto.';
    await store.updateActionSyncState(action.id, 'failed', null, message);
    return { action_id: action.id, status: 'failed', message };
  }

  await store.updateActionSyncState(action.id, 'synced', projectId, null);
  return {
    action_id: action.id,
    status: 'synced',
    message: 'Estado de proyecto actualizado en IRIS.',
  };
}
