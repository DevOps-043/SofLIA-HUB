import type { Dispatch, SetStateAction } from 'react';
import {
  approveMeetingActions,
  approveMeetingAsset,
  createDriveMeetingRun,
  createManualMeetingRun,
  rejectMeetingAction,
  syncApprovedMeetingActions,
  updateMeetingAction,
  type MeetingRunDetail,
} from '../../../services/meeting-service';
import type { ActionDraft, CreateMode, MeetingOpsForm } from './types';

interface ActionConfig {
  userId: string;
  organizationId?: string;
  mode: CreateMode;
  form: MeetingOpsForm;
  detail: MeetingRunDetail | null;
  actionDrafts: Record<string, ActionDraft>;
  loadInitialData: () => Promise<void>;
  setForm: Dispatch<SetStateAction<MeetingOpsForm>>;
  setLoading: Dispatch<SetStateAction<boolean>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setNotice: Dispatch<SetStateAction<string | null>>;
  setSelectedRunId: Dispatch<SetStateAction<string | null>>;
  setDetail: Dispatch<SetStateAction<MeetingRunDetail | null>>;
}

export function useMeetingOpsActions(config: ActionConfig) {
  async function handleCreateRun(): Promise<void> {
    config.setLoading(true); config.setError(null); config.setNotice(null);
    try {
      const base = {
        organizationId: config.organizationId || null, workspaceId: null, ownerUserId: config.userId,
        originChannel: 'app' as const, originRef: 'app:meeting-ops',
        meetingTitle: config.form.meetingTitle || null, meetingType: config.form.meetingType || 'general',
        defaultTeamId: config.form.defaultTeamId || null, defaultProjectId: config.form.defaultProjectId || null,
      };
      const result = config.mode === 'manual'
        ? await createManualMeetingRun({ ...base, text: config.form.manualText })
        : await createDriveMeetingRun({ ...base, fileIdOrUrl: config.form.driveRef });
      if (!result.success || !result.result) throw new Error(result.error || 'No pude crear el run.');
      await config.loadInitialData();
      config.setSelectedRunId(result.result.detail.run.id);
      config.setDetail(result.result.detail);
      config.setNotice(result.result.deduplicated ? 'Fuente reutilizada del run previo.' : 'Run creado correctamente.');
      config.setForm((current) => ({ ...current, manualText: '', driveRef: '' }));
    } catch (err: any) {
      config.setError(err?.message || 'No pude crear el run.');
    } finally {
      config.setLoading(false);
    }
  }

  return {
    handleCreateRun,
    handleApproveAsset: () => approveAsset(config),
    handleApproveActions: () => approveActions(config),
    handleApproveSingleAction: (actionId: string) => approveActions(config, actionId),
    handleSaveAction: (actionId: string) => saveAction(config, actionId),
    handleRejectAction: (actionId: string) => rejectAction(config, actionId),
    handleSyncActions: () => syncActions(config),
  };
}

async function approveAsset(config: ActionConfig) {
  if (!config.detail) return;
  const r = await approveMeetingAsset({ runId: config.detail.run.id, decidedByUserId: config.userId, comment: 'Aprobado desde la app' });
  if (!r.success || !r.detail) { config.setError(r.error || 'Error al aprobar.'); return; }
  config.setDetail(r.detail); config.setNotice('Resumen aprobado.'); await config.loadInitialData();
}

async function approveActions(config: ActionConfig, actionId?: string) {
  if (!config.detail) return;
  const r = await approveMeetingActions({ runId: config.detail.run.id, decidedByUserId: config.userId, actionIds: actionId ? [actionId] : undefined, comment: actionId ? 'Aprobada' : 'Acciones aprobadas' });
  if (!r.success || !r.detail) { config.setError(actionId ? 'Error.' : r.error || 'Error al aprobar acciones.'); return; }
  config.setDetail(r.detail); config.setNotice(actionId ? 'Accion aprobada.' : 'Acciones aprobadas.'); await config.loadInitialData();
}

async function saveAction(config: ActionConfig, actionId: string) {
  const draft = config.actionDrafts[actionId];
  if (!draft) return;
  const r = await updateMeetingAction({ actionId, updates: { title: draft.title, due_date: draft.dueDate || null, team_id: draft.teamId || null, project_id: draft.projectId || null, assignee_id: draft.assigneeId || null, issue_id: draft.existingIssueId || null } });
  if (!r.success || !r.detail) { config.setError(r.error || 'Error al guardar.'); return; }
  config.setDetail(r.detail); config.setNotice('Accion actualizada.'); await config.loadInitialData();
}

async function rejectAction(config: ActionConfig, actionId: string) {
  const r = await rejectMeetingAction({ actionId, decidedByUserId: config.userId, comment: 'Rechazada' });
  if (!r.success || !r.detail) { config.setError(r.error || 'Error al rechazar.'); return; }
  config.setDetail(r.detail); config.setNotice('Accion rechazada.'); await config.loadInitialData();
}

async function syncActions(config: ActionConfig) {
  if (!config.detail) return;
  const r = await syncApprovedMeetingActions({ runId: config.detail.run.id, decidedByUserId: config.userId });
  if (!r.success || !r.detail) { config.setError(r.error || 'Error al sincronizar.'); return; }
  config.setDetail(r.detail); config.setNotice(`Sincronizadas: ${r.result?.synced || 0} | Fallidas: ${r.result?.failed || 0}`);
  await config.loadInitialData();
}
