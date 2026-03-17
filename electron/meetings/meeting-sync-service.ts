import { createIssue, getWhatsAppSession, updateIssueStatus, updateProjectStatus } from '../iris-data-main';
import type { MeetingStore } from './meeting-store';
import type { MeetingSyncActionRecord, MeetingSyncExecutionResult } from './meeting-types';

export class MeetingSyncService {
  constructor(private readonly store: MeetingStore) {}

  async syncApprovedActions(runId: string, ownerUserId: string): Promise<MeetingSyncExecutionResult> {
    const actions = await this.store.getApprovedPendingActions(runId);
    const details: MeetingSyncExecutionResult['details'] = [];

    if (actions.length === 0) {
      return {
        synced: 0,
        failed: 0,
        skipped: 0,
        details: [],
      };
    }

    let synced = 0;
    let failed = 0;
    let skipped = 0;

    for (const action of actions) {
      const result = await this.syncSingleAction(action, ownerUserId);
      details.push(result);
      if (result.status === 'synced') synced += 1;
      if (result.status === 'failed') failed += 1;
      if (result.status === 'skipped') skipped += 1;
    }

    return { synced, failed, skipped, details };
  }

  private async syncSingleAction(
    action: MeetingSyncActionRecord,
    ownerUserId: string,
  ): Promise<MeetingSyncExecutionResult['details'][number]> {
    if (action.blocking_flags.length > 0) {
      await this.store.updateActionSyncState(
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
        if (!action.payload.team_id) {
          await this.store.updateActionSyncState(action.id, 'failed', null, 'Falta team_id para crear la tarea.');
          return {
            action_id: action.id,
            status: 'failed',
            message: 'Falta team_id para crear la tarea.',
          };
        }

        const creatorUserId = action.payload.creator_user_id || this.resolveCreatorUserId(ownerUserId) || action.payload.assignee_id;
        if (!creatorUserId) {
          await this.store.updateActionSyncState(
            action.id,
            'failed',
            null,
            'No pude resolver un creator_user_id valido para crear la tarea en IRIS.',
          );
          return {
            action_id: action.id,
            status: 'failed',
            message: 'No pude resolver un creator_user_id valido para crear la tarea en IRIS.',
          };
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
          await this.store.updateActionSyncState(action.id, 'failed', null, issueResult.error || 'No se pudo crear la tarea.');
          return {
            action_id: action.id,
            status: 'failed',
            message: issueResult.error || 'No se pudo crear la tarea.',
          };
        }

        const externalRef =
          issueResult.issue.issue_id ||
          issueResult.issue.id ||
          issueResult.issue.task_issue_id ||
          null;
        await this.store.updateActionSyncState(action.id, 'synced', externalRef, null);
        return {
          action_id: action.id,
          status: 'synced',
          message: 'Tarea creada en IRIS.',
        };
      }

      if (action.action_type === 'update_task_status') {
        const updateResult = await updateIssueStatus({
          issueId: action.payload.issue_id,
          teamId: action.payload.team_id,
          newStatusName: action.payload.new_status_name,
        });

        if (!updateResult.success) {
          await this.store.updateActionSyncState(action.id, 'failed', null, updateResult.error || 'No se pudo actualizar la tarea.');
          return {
            action_id: action.id,
            status: 'failed',
            message: updateResult.error || 'No se pudo actualizar la tarea.',
          };
        }

        await this.store.updateActionSyncState(action.id, 'synced', action.payload.issue_id || null, null);
        return {
          action_id: action.id,
          status: 'synced',
          message: 'Estado de tarea actualizado en IRIS.',
        };
      }

      if (action.action_type === 'update_project_status') {
        const projectId = action.payload.project_id_to_update || action.payload.project_id;
        const newStatus = action.payload.new_project_status;

        if (!projectId || !newStatus) {
          await this.store.updateActionSyncState(action.id, 'failed', null, 'Faltan datos para actualizar el proyecto.');
          return {
            action_id: action.id,
            status: 'failed',
            message: 'Faltan datos para actualizar el proyecto.',
          };
        }

        const updateResult = await updateProjectStatus({
          projectId,
          newStatus: newStatus as 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled' | 'archived',
        });

        if (!updateResult.success) {
          await this.store.updateActionSyncState(action.id, 'failed', null, updateResult.error || 'No se pudo actualizar el proyecto.');
          return {
            action_id: action.id,
            status: 'failed',
            message: updateResult.error || 'No se pudo actualizar el proyecto.',
          };
        }

        await this.store.updateActionSyncState(action.id, 'synced', projectId, null);
        return {
          action_id: action.id,
          status: 'synced',
          message: 'Estado de proyecto actualizado en IRIS.',
        };
      }

      await this.store.updateActionSyncState(action.id, 'failed', null, 'La accion no esta soportada por Meeting Ops.');
      return {
        action_id: action.id,
        status: 'failed',
        message: 'La accion no esta soportada por Meeting Ops.',
      };
    } catch (error: any) {
      const message = error?.message || String(error);
      await this.store.updateActionSyncState(action.id, 'failed', null, message);
      return {
        action_id: action.id,
        status: 'failed',
        message,
      };
    }
  }

  private resolveCreatorUserId(ownerUserId: string): string | null {
    const session = getWhatsAppSession(ownerUserId);
    if (session?.userId) {
      return session.userId;
    }
    return ownerUserId || null;
  }
}
