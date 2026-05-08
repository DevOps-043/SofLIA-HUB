import type { MeetingStore } from '../meeting-store';
import type { MeetingSyncActionRecord } from '../meeting-types';
import { syncCreateTaskAction } from './sync-create-task';
import { syncUpdateProjectStatusAction } from './sync-update-project-status';
import { syncUpdateTaskStatusAction } from './sync-update-task-status';
import type { SyncActionDetail } from './types';

export async function syncMeetingAction(
  store: MeetingStore,
  action: MeetingSyncActionRecord,
  ownerUserId: string,
): Promise<SyncActionDetail> {
  if (action.blocking_flags.length > 0) {
    await store.updateActionSyncState(
      action.id,
      'failed',
      null,
      `La accion sigue bloqueada: ${action.blocking_flags.join(', ')}`,
    );
    return {
      action_id: action.id,
      status: 'failed',
      message: 'La accion sigue bloqueada por flags de revision.',
    };
  }

  try {
    if (action.action_type === 'create_task') {
      return syncCreateTaskAction({ store, action, ownerUserId });
    }
    if (action.action_type === 'update_task_status') {
      return syncUpdateTaskStatusAction({ store, action, ownerUserId });
    }
    if (action.action_type === 'update_project_status') {
      return syncUpdateProjectStatusAction({ store, action, ownerUserId });
    }

    await store.updateActionSyncState(action.id, 'failed', null, 'La accion no esta soportada por Meeting Ops.');
    return {
      action_id: action.id,
      status: 'failed',
      message: 'La accion no esta soportada por Meeting Ops.',
    };
  } catch (error: any) {
    const message = error?.message || String(error);
    await store.updateActionSyncState(action.id, 'failed', null, message);
    return { action_id: action.id, status: 'failed', message };
  }
}
