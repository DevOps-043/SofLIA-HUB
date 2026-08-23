import type { MeetingStore } from './meeting-store';
import type { MeetingSyncExecutionResult } from './meeting-types';
import { syncMeetingAction } from './meeting-sync/sync-meeting-action';
import { getProjectHubApiService } from '../project-hub';
import type { MeetingSyncActionRecord } from './meeting-types';

export class MeetingSyncService {
  constructor(private readonly store: MeetingStore) {}

  async syncApprovedActions(runId: string, ownerUserId: string): Promise<MeetingSyncExecutionResult> {
    const actions = await this.store.getApprovedPendingActions(runId);
    const details: MeetingSyncExecutionResult['details'] = [];

    if (actions.length === 0) {
      return { synced: 0, failed: 0, skipped: 0, details: [] };
    }

    if (process.env.MEETING_PROJECT_SYNC_V2 !== 'false') {
      return this.syncThroughProjectHub(runId, actions);
    }

    let synced = 0;
    let failed = 0;
    let skipped = 0;

    for (const action of actions) {
      const result = await syncMeetingAction(this.store, action, ownerUserId);
      details.push(result);
      if (result.status === 'synced') synced += 1;
      if (result.status === 'failed') failed += 1;
      if (result.status === 'skipped') skipped += 1;
    }

    return { synced, failed, skipped, details };
  }

  private async syncThroughProjectHub(runId: string, actions: MeetingSyncActionRecord[]): Promise<MeetingSyncExecutionResult> {
    const detail = await this.store.getRunDetail(runId);
    const asset = detail?.latest_asset;
    if (!detail || !asset) return this.failAll(actions, 'La reunión no tiene una minuta aprobable.');

    const projectIds = [...new Set(actions.map((action) => action.payload.project_id || action.payload.project_id_to_update).filter((value): value is string => Boolean(value)))];
    if (projectIds.length !== 1) return this.failAll(actions, 'Selecciona un único proyecto para las acciones aprobadas.');
    const projectId = projectIds[0];
    const api = getProjectHubApiService();
    const workspaceId = await api.findProjectWorkspace(projectId);
    if (!workspaceId) return this.failAll(actions, 'El proyecto no está disponible en los workspaces autorizados.');

    const analysis = asset.payload.analysis_result;
    let position = 0;
    const analysisItems = [
      ...(analysis?.decisions || []).map((item) => ({ type: 'decision', position: position++, content: item.description, metadata: { confidence: item.confidence, evidence: item.evidence || [] } })),
      ...(analysis?.agreements || []).map((item) => ({ type: 'agreement', position: position++, content: item.description, metadata: { confidence: item.confidence, evidence: item.evidence || [] } })),
      ...(analysis?.risks || []).map((item) => ({ type: 'risk', position: position++, content: item.description, metadata: { severity: item.severity, confidence: item.confidence } })),
      ...(analysis?.openQuestions || []).map((item) => ({ type: 'question', position: position++, content: item.question, metadata: { confidence: item.confidence } })),
    ];
    const items = [
      ...analysisItems,
      ...actions.map((action, index) => ({
        type: 'excerpt' as const,
        position: index,
        title: action.action_type,
        content: action.summary,
        metadata: { action_id: action.id },
      })),
    ];
    const tasks = actions.map((action, index) => action.action_type === 'create_task'
      ? action.payload.issue_id
        ? { mode: 'link', issue_id: action.payload.issue_id, evidence_item_position: index }
        : { mode: 'create', title: action.payload.title || action.summary, description: action.payload.description, assignee_id: action.payload.assignee_id || undefined, due_date: action.payload.due_date || undefined, evidence_item_position: index }
      : action.action_type === 'update_task_status' && action.payload.issue_id
        ? { mode: 'link', issue_id: action.payload.issue_id, evidence_item_position: index }
        : { mode: 'ignore', evidence_item_position: index });

    const importResult = await api.importMeeting({
      workspaceId, projectId,
      idempotencyKey: `meeting:${detail.run.id}:${asset.id}:v${asset.asset_version}:approved`,
      meeting: {
        approved: true,
        evidence: {
          external_reference: detail.run.id, version: asset.asset_version,
          title: detail.run.meeting_title || 'Reunión', summary: asset.executive_summary,
          content_hash: detail.run.source_hash,
          metadata: { lia_run_id: detail.run.id, lia_asset_id: asset.id, source_version: detail.run.source_version },
        },
        items, tasks,
      },
    });
    if (!importResult.success) return this.failAll(actions, importResult.error || 'Project Hub rechazó la importación.');

    const evidenceId = (importResult.data as { evidence_id?: string } | undefined)?.evidence_id || null;
    const results: MeetingSyncExecutionResult['details'] = [];
    for (const action of actions) {
      if (action.action_type === 'update_task_status' && action.payload.issue_id && action.payload.new_status_name) {
        // El contrato v1 usa status_id, por lo que una etiqueta de estado sin
        // resolver queda como evidencia y no se inventa un UUID.
      }
      if (action.action_type === 'update_project_status' && action.payload.new_project_status) {
        await api.updateProject({ workspaceId, projectId, updates: { status: action.payload.new_project_status } });
      }
      await this.store.updateActionSyncState(action.id, 'synced', evidenceId, null);
      results.push({ action_id: action.id, status: 'synced', message: 'Acción y evidencia sincronizadas con Project Hub.' });
    }
    return { synced: actions.length, failed: 0, skipped: 0, details: results };
  }

  private async failAll(actions: MeetingSyncActionRecord[], message: string): Promise<MeetingSyncExecutionResult> {
    for (const action of actions) await this.store.updateActionSyncState(action.id, 'failed', null, message);
    return { synced: 0, failed: actions.length, skipped: 0, details: actions.map((action) => ({ action_id: action.id, status: 'failed' as const, message })) };
  }
}
