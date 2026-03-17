import React, { useEffect, useMemo, useState } from 'react';
import {
  approveMeetingActions,
  approveMeetingAsset,
  createDriveMeetingRun,
  createManualMeetingRun,
  getMeetingContext,
  getMeetingRunDetail,
  listMeetingRuns,
  onMeetingDetected,
  rejectMeetingAction,
  removeMeetingListeners,
  syncApprovedMeetingActions,
  updateMeetingAction,
  type MeetingContextProject,
  type MeetingContextTeam,
  type MeetingContextTeamMember,
  type MeetingRunDetail,
  type MeetingRunSummary,
} from '../../services/meeting-service';

interface MeetingOpsPanelProps {
  userId: string;
  organizationId?: string | null;
}

type CreateMode = 'manual' | 'drive';
type ActionDraft = {
  title: string;
  dueDate: string;
  teamId: string;
  projectId: string;
  assigneeId: string;
};

const DEFAULT_FORM = {
  meetingTitle: '',
  meetingType: 'general',
  defaultTeamId: '',
  defaultProjectId: '',
  manualText: '',
  driveRef: '',
};

export const MeetingOpsPanel: React.FC<MeetingOpsPanelProps> = ({ userId, organizationId }) => {
  const [mode, setMode] = useState<CreateMode>('manual');
  const [form, setForm] = useState(DEFAULT_FORM);
  const [runs, setRuns] = useState<MeetingRunSummary[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [detail, setDetail] = useState<MeetingRunDetail | null>(null);
  const [actionDrafts, setActionDrafts] = useState<Record<string, ActionDraft>>({});
  const [teams, setTeams] = useState<MeetingContextTeam[]>([]);
  const [projects, setProjects] = useState<MeetingContextProject[]>([]);
  const [teamMembers, setTeamMembers] = useState<MeetingContextTeamMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    void loadInitialData();
  }, [userId]);

  useEffect(() => {
    onMeetingDetected((event) => {
      if (event.ownerUserId !== userId) {
        return;
      }

      setNotice(`Nueva reunion detectada: ${event.meetingTitle || event.sourceFileName || 'Sin titulo'}.`);
      setSelectedRunId(event.runId);
      void loadInitialData();
      void loadRunDetail(event.runId);
    });

    return () => {
      removeMeetingListeners();
    };
  }, [userId]);

  useEffect(() => {
    if (!selectedRunId) return;
    void loadRunDetail(selectedRunId);
  }, [selectedRunId]);

  useEffect(() => {
    if (!detail) {
      setActionDrafts({});
      return;
    }
    const nextDrafts: Record<string, ActionDraft> = {};
    for (const action of detail.sync_actions) {
      nextDrafts[action.id] = {
        title: action.payload.title || action.summary || '',
        dueDate: action.payload.due_date || '',
        teamId: action.payload.team_id || '',
        projectId: action.payload.project_id || '',
        assigneeId: action.payload.assignee_id || '',
      };
    }
    setActionDrafts(nextDrafts);
  }, [detail]);

  const visibleProjects = useMemo(() => {
    if (!form.defaultTeamId) return projects;
    return projects.filter((project) => !project.team_id || project.team_id === form.defaultTeamId);
  }, [projects, form.defaultTeamId]);

  async function loadInitialData(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const [runsResult, contextResult] = await Promise.all([
        listMeetingRuns({ ownerUserId: userId, limit: 20 }),
        getMeetingContext(),
      ]);

      if (!runsResult.success) {
        throw new Error(runsResult.error || 'No pude cargar los runs.');
      }
      if (!contextResult.success) {
        throw new Error(contextResult.error || 'No pude cargar el contexto de IRIS.');
      }

      const nextRuns = runsResult.runs || [];
      setRuns(nextRuns);
      setTeams(contextResult.teams || []);
      setProjects(contextResult.projects || []);
      setTeamMembers(contextResult.teamMembers || []);

      if (!selectedRunId && nextRuns.length > 0) {
        setSelectedRunId(nextRuns[0].run.id);
      }
    } catch (err: any) {
      setError(err?.message || 'No pude cargar Meeting Ops.');
    } finally {
      setLoading(false);
    }
  }

  async function loadRunDetail(runId: string): Promise<void> {
    setError(null);
    const result = await getMeetingRunDetail(runId);
    if (!result.success || !result.detail) {
      setError(result.error || 'No pude cargar el detalle del run.');
      return;
    }
    setDetail(result.detail);
  }

  async function handleCreateRun(): Promise<void> {
    setLoading(true);
    setError(null);
    setNotice(null);

    try {
      const basePayload = {
        organizationId: organizationId || null,
        workspaceId: null,
        ownerUserId: userId,
        originChannel: 'app' as const,
        originRef: 'app:meeting-ops',
        meetingTitle: form.meetingTitle || null,
        meetingType: form.meetingType || 'general',
        defaultTeamId: form.defaultTeamId || null,
        defaultProjectId: form.defaultProjectId || null,
      };

      const result = mode === 'manual'
        ? await createManualMeetingRun({
          ...basePayload,
          text: form.manualText,
        })
        : await createDriveMeetingRun({
          ...basePayload,
          fileIdOrUrl: form.driveRef,
        });

      if (!result.success || !result.result) {
        throw new Error(result.error || 'No pude crear el run.');
      }

      await loadInitialData();
      setSelectedRunId(result.result.detail.run.id);
      setDetail(result.result.detail);
      setNotice(result.result.deduplicated
        ? 'La fuente ya existia. Se reutilizo el run previo.'
        : 'Run creado correctamente.');
      setForm((current) => ({
        ...current,
        manualText: '',
        driveRef: '',
      }));
    } catch (err: any) {
      setError(err?.message || 'No pude crear el run.');
    } finally {
      setLoading(false);
    }
  }

  async function handleApproveAsset(): Promise<void> {
    if (!detail) return;
    const result = await approveMeetingAsset({
      runId: detail.run.id,
      decidedByUserId: userId,
      comment: 'Aprobado desde la app',
    });
    if (!result.success || !result.detail) {
      setError(result.error || 'No pude aprobar el resumen.');
      return;
    }
    setDetail(result.detail);
    setNotice('Resumen aprobado.');
    await loadInitialData();
  }

  async function handleApproveActions(): Promise<void> {
    if (!detail) return;
    const result = await approveMeetingActions({
      runId: detail.run.id,
      decidedByUserId: userId,
      comment: 'Acciones aprobadas desde la app',
    });
    if (!result.success || !result.detail) {
      setError(result.error || 'No pude aprobar las acciones.');
      return;
    }
    setDetail(result.detail);
    setNotice('Acciones aprobadas.');
    await loadInitialData();
  }

  async function handleApproveSingleAction(actionId: string): Promise<void> {
    if (!detail) return;
    const result = await approveMeetingActions({
      runId: detail.run.id,
      decidedByUserId: userId,
      actionIds: [actionId],
      comment: 'Accion aprobada desde la app',
    });
    if (!result.success || !result.detail) {
      setError(result.error || 'No pude aprobar la accion.');
      return;
    }
    setDetail(result.detail);
    setNotice('Accion aprobada.');
    await loadInitialData();
  }

  async function handleSaveAction(actionId: string): Promise<void> {
    const draft = actionDrafts[actionId];
    if (!draft) return;
    const result = await updateMeetingAction({
      actionId,
      updates: {
        title: draft.title,
        due_date: draft.dueDate || null,
        team_id: draft.teamId || null,
        project_id: draft.projectId || null,
        assignee_id: draft.assigneeId || null,
      },
    });
    if (!result.success || !result.detail) {
      setError(result.error || 'No pude actualizar la accion.');
      return;
    }
    setDetail(result.detail);
    setNotice('Accion actualizada. Requiere aprobacion si cambiaste datos.');
    await loadInitialData();
  }

  async function handleRejectAction(actionId: string): Promise<void> {
    const result = await rejectMeetingAction({
      actionId,
      decidedByUserId: userId,
      comment: 'Rechazada desde la app',
    });
    if (!result.success || !result.detail) {
      setError(result.error || 'No pude rechazar la accion.');
      return;
    }
    setDetail(result.detail);
    setNotice('Accion rechazada.');
    await loadInitialData();
  }

  async function handleSyncActions(): Promise<void> {
    if (!detail) return;
    const result = await syncApprovedMeetingActions({
      runId: detail.run.id,
      decidedByUserId: userId,
    });
    if (!result.success || !result.detail) {
      setError(result.error || 'No pude sincronizar las acciones.');
      return;
    }
    setDetail(result.detail);
    setNotice(`Sincronizacion terminada. Sincronizadas: ${result.result?.synced || 0}, fallidas: ${result.result?.failed || 0}.`);
    await loadInitialData();
  }

  function updateActionDraft(actionId: string, patch: Partial<ActionDraft>): void {
    setActionDrafts((current) => ({
      ...current,
      [actionId]: {
        ...(current[actionId] || { title: '', dueDate: '', teamId: '', projectId: '', assigneeId: '' }),
        ...patch,
      },
    }));
  }

  function getProjectsForTeam(teamId: string): MeetingContextProject[] {
    if (!teamId) return projects;
    return projects.filter((project) => !project.team_id || project.team_id === teamId);
  }

  function getMembersForTeam(teamId: string): MeetingContextTeamMember[] {
    if (!teamId) return [];
    return teamMembers.filter((member) => member.team_id === teamId);
  }

  return (
    <div className="h-full overflow-hidden flex flex-col pt-2">
      <div className="px-6 pb-4">
        <h3 className="text-gray-900 dark:text-white text-lg font-semibold">Meeting Ops</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Primer workflow compartido entre WhatsApp y la app para importar, revisar y sincronizar reuniones.
        </p>
      </div>

      <div className="flex-1 overflow-hidden border-t border-white/5 grid grid-cols-[380px_minmax(0,1fr)]">
        <section className="border-r border-black/5 dark:border-white/5 overflow-y-auto no-scrollbar p-5 space-y-5">
          <div className="rounded-3xl border border-black/5 dark:border-white/5 bg-white/80 dark:bg-white/[0.03] p-4 space-y-4">
            <div className="flex gap-2">
              <button
                type="button"
                className={`px-3 py-2 rounded-2xl text-sm font-medium ${mode === 'manual' ? 'bg-accent text-white' : 'bg-black/5 dark:bg-white/5 text-gray-600 dark:text-gray-300'}`}
                onClick={() => setMode('manual')}
              >
                Notas manuales
              </button>
              <button
                type="button"
                className={`px-3 py-2 rounded-2xl text-sm font-medium ${mode === 'drive' ? 'bg-accent text-white' : 'bg-black/5 dark:bg-white/5 text-gray-600 dark:text-gray-300'}`}
                onClick={() => setMode('drive')}
              >
                Google Drive
              </button>
            </div>

            <label className="block">
              <span className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Titulo</span>
              <input
                className="mt-1 w-full rounded-2xl border border-black/5 dark:border-white/5 bg-transparent px-3 py-2 text-sm"
                value={form.meetingTitle}
                onChange={(event) => setForm({ ...form, meetingTitle: event.target.value })}
                placeholder="Weekly delivery, kickoff, retro..."
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Tipo</span>
                <input
                  className="mt-1 w-full rounded-2xl border border-black/5 dark:border-white/5 bg-transparent px-3 py-2 text-sm"
                  value={form.meetingType}
                  onChange={(event) => setForm({ ...form, meetingType: event.target.value })}
                />
              </label>

              <label className="block">
                <span className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Team IRIS</span>
                <select
                  className="mt-1 w-full rounded-2xl border border-black/5 dark:border-white/5 bg-transparent px-3 py-2 text-sm"
                  value={form.defaultTeamId}
                  onChange={(event) => setForm({ ...form, defaultTeamId: event.target.value, defaultProjectId: '' })}
                >
                  <option value="">Sin team</option>
                  {teams.map((team) => (
                    <option key={team.team_id} value={team.team_id}>{team.name}</option>
                  ))}
                </select>
              </label>
            </div>

            <label className="block">
              <span className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Proyecto IRIS</span>
              <select
                className="mt-1 w-full rounded-2xl border border-black/5 dark:border-white/5 bg-transparent px-3 py-2 text-sm"
                value={form.defaultProjectId}
                onChange={(event) => setForm({ ...form, defaultProjectId: event.target.value })}
              >
                <option value="">Sin proyecto</option>
                {visibleProjects.map((project) => (
                  <option key={project.project_id} value={project.project_id}>{project.project_name}</option>
                ))}
              </select>
            </label>

            {mode === 'manual' ? (
              <label className="block">
                <span className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Notas o transcripcion</span>
                <textarea
                  className="mt-1 w-full min-h-44 rounded-3xl border border-black/5 dark:border-white/5 bg-transparent px-3 py-3 text-sm resize-y"
                  value={form.manualText}
                  onChange={(event) => setForm({ ...form, manualText: event.target.value })}
                  placeholder="Pega aqui las notas de la reunion, compromisos, decisiones y bloqueos."
                />
              </label>
            ) : (
              <label className="block">
                <span className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Link o ID de Drive</span>
                <input
                  className="mt-1 w-full rounded-2xl border border-black/5 dark:border-white/5 bg-transparent px-3 py-2 text-sm"
                  value={form.driveRef}
                  onChange={(event) => setForm({ ...form, driveRef: event.target.value })}
                  placeholder="https://drive.google.com/... o 1AbcDEF..."
                />
              </label>
            )}

            <button
              type="button"
              className="w-full rounded-2xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-4 py-3 text-sm font-semibold disabled:opacity-50"
              onClick={() => void handleCreateRun()}
              disabled={loading || (mode === 'manual' ? !form.manualText.trim() : !form.driveRef.trim())}
            >
              {loading ? 'Procesando...' : 'Crear run'}
            </button>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Runs recientes</h4>
              <button
                type="button"
                className="text-xs text-accent"
                onClick={() => void loadInitialData()}
              >
                Recargar
              </button>
            </div>

            <div className="space-y-2">
              {runs.length === 0 && (
                <div className="rounded-2xl border border-dashed border-black/10 dark:border-white/10 p-4 text-sm text-gray-500 dark:text-gray-400">
                  No hay runs todavia.
                </div>
              )}

              {runs.map((runSummary) => (
                <button
                  key={runSummary.run.id}
                  type="button"
                  className={`w-full text-left rounded-2xl border p-4 transition ${
                    selectedRunId === runSummary.run.id
                      ? 'border-accent/40 bg-accent/5'
                      : 'border-black/5 dark:border-white/5 bg-white/70 dark:bg-white/[0.02]'
                  }`}
                  onClick={() => setSelectedRunId(runSummary.run.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-gray-900 dark:text-white">
                        {runSummary.run.meeting_title || 'Reunion sin titulo'}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {runSummary.run.status} | {new Date(runSummary.run.created_at).toLocaleString()}
                      </div>
                    </div>
                    <div className="text-right text-xs text-gray-500 dark:text-gray-400">
                      <div>{runSummary.counts.approved_actions} aprobadas</div>
                      <div>{runSummary.counts.synced_actions} sincronizadas</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="overflow-y-auto no-scrollbar p-6">
          {error && (
            <div className="mb-4 rounded-2xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-600 dark:text-red-300">
              {error}
            </div>
          )}
          {notice && (
            <div className="mb-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
              {notice}
            </div>
          )}

          {!detail && (
            <div className="h-full rounded-[2rem] border border-dashed border-black/10 dark:border-white/10 flex items-center justify-center text-sm text-gray-500 dark:text-gray-400">
              Selecciona un run para revisar el resultado.
            </div>
          )}

          {detail && (
            <div className="space-y-5">
              <div className="rounded-[2rem] border border-black/5 dark:border-white/5 bg-white/75 dark:bg-white/[0.02] p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h4 className="text-xl font-semibold text-gray-900 dark:text-white">
                      {detail.run.meeting_title || 'Reunion sin titulo'}
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {detail.run.status} | {detail.run.meeting_type} | {new Date(detail.run.created_at).toLocaleString()}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded-2xl px-3 py-2 text-sm font-medium bg-black/5 dark:bg-white/5"
                      onClick={() => void handleApproveAsset()}
                    >
                      Aprobar resumen
                    </button>
                    <button
                      type="button"
                      className="rounded-2xl px-3 py-2 text-sm font-medium bg-black/5 dark:bg-white/5"
                      onClick={() => void handleApproveActions()}
                    >
                      Aprobar acciones
                    </button>
                    <button
                      type="button"
                      className="rounded-2xl px-3 py-2 text-sm font-medium bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                      onClick={() => void handleSyncActions()}
                    >
                      Sincronizar
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid md:grid-cols-2 gap-4">
                  <div className="rounded-3xl bg-black/[0.025] dark:bg-white/[0.03] p-4">
                    <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Resumen ejecutivo</div>
                    <p className="mt-2 text-sm leading-6 text-gray-700 dark:text-gray-200">
                      {detail.latest_asset?.executive_summary || 'Sin resumen ejecutivo.'}
                    </p>
                  </div>
                  <div className="rounded-3xl bg-black/[0.025] dark:bg-white/[0.03] p-4">
                    <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Resumen operativo</div>
                    <p className="mt-2 text-sm leading-6 text-gray-700 dark:text-gray-200">
                      {detail.latest_asset?.operational_summary || 'Sin resumen operativo.'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid xl:grid-cols-3 gap-5">
                <div className="rounded-[2rem] border border-black/5 dark:border-white/5 p-5">
                  <h5 className="text-sm font-semibold text-gray-900 dark:text-white">Compromisos</h5>
                  <div className="mt-4 space-y-3">
                    {(detail.latest_asset?.payload.commitments || []).map((commitment, index) => (
                      <div key={`${commitment.statement}-${index}`} className="rounded-2xl bg-black/[0.025] dark:bg-white/[0.03] p-3">
                        <div className="text-sm text-gray-800 dark:text-gray-100">{commitment.statement}</div>
                        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                          Responsable: {commitment.owner_candidate || 'Pendiente'} | Fecha: {commitment.due_date_candidate || 'Pendiente'} | Estado: {commitment.status}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-[2rem] border border-black/5 dark:border-white/5 p-5">
                  <h5 className="text-sm font-semibold text-gray-900 dark:text-white">Flags de revision</h5>
                  <div className="mt-4 space-y-3">
                    {(detail.latest_asset?.review_flags || []).length === 0 && (
                      <div className="rounded-2xl bg-emerald-500/5 p-3 text-sm text-emerald-700 dark:text-emerald-300">
                        Sin flags bloqueantes.
                      </div>
                    )}
                    {(detail.latest_asset?.review_flags || []).map((flag, index) => (
                      <div key={`${flag.code}-${index}`} className="rounded-2xl bg-amber-500/5 p-3">
                        <div className="text-sm font-medium text-amber-800 dark:text-amber-300">{flag.code}</div>
                        <div className="mt-1 text-xs text-amber-700/80 dark:text-amber-200/80">{flag.message}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-[2rem] border border-black/5 dark:border-white/5 p-5">
                  <h5 className="text-sm font-semibold text-gray-900 dark:text-white">Acciones propuestas</h5>
                  <div className="mt-4 space-y-3">
                    {detail.sync_actions.length === 0 && (
                      <div className="rounded-2xl bg-black/[0.025] dark:bg-white/[0.03] p-3 text-sm text-gray-500 dark:text-gray-400">
                        No hay acciones propuestas.
                      </div>
                    )}
                    {detail.sync_actions.map((action) => (
                      <div key={action.id} className="rounded-2xl bg-black/[0.025] dark:bg-white/[0.03] p-3">
                      <div className="text-sm text-gray-800 dark:text-gray-100">{action.summary}</div>
                      <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        {action.approval_state} | {action.sync_state}
                      </div>
                      <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        Responsable detectado: {action.payload.owner_candidate || 'No detectado'}
                      </div>
                      <div className="mt-3 grid gap-2">
                        <input
                          className="w-full rounded-xl border border-black/5 dark:border-white/5 bg-transparent px-3 py-2 text-sm"
                            value={actionDrafts[action.id]?.title || ''}
                            onChange={(event) => updateActionDraft(action.id, { title: event.target.value })}
                            placeholder="Titulo de la tarea"
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <select
                              className="w-full rounded-xl border border-black/5 dark:border-white/5 bg-transparent px-3 py-2 text-sm"
                              value={actionDrafts[action.id]?.teamId || ''}
                              onChange={(event) => updateActionDraft(action.id, {
                                teamId: event.target.value,
                                projectId: '',
                                assigneeId: '',
                              })}
                            >
                              <option value="">Sin team</option>
                              {teams.map((team) => (
                                <option key={team.team_id} value={team.team_id}>{team.name}</option>
                              ))}
                            </select>
                            <select
                              className="w-full rounded-xl border border-black/5 dark:border-white/5 bg-transparent px-3 py-2 text-sm"
                              value={actionDrafts[action.id]?.projectId || ''}
                              onChange={(event) => updateActionDraft(action.id, { projectId: event.target.value })}
                            >
                              <option value="">Sin proyecto</option>
                              {getProjectsForTeam(actionDrafts[action.id]?.teamId || '').map((project) => (
                                <option key={project.project_id} value={project.project_id}>{project.project_name}</option>
                              ))}
                            </select>
                          </div>
                          <select
                            className="w-full rounded-xl border border-black/5 dark:border-white/5 bg-transparent px-3 py-2 text-sm"
                            value={actionDrafts[action.id]?.assigneeId || ''}
                            onChange={(event) => updateActionDraft(action.id, { assigneeId: event.target.value })}
                          >
                            <option value="">Sin responsable asignado</option>
                            {getMembersForTeam(actionDrafts[action.id]?.teamId || '').map((member) => (
                              <option key={member.membership_id} value={member.user_id}>
                                {member.display_name || member.username || member.email || member.user_id}
                              </option>
                            ))}
                          </select>
                          <input
                            type="date"
                            className="w-full rounded-xl border border-black/5 dark:border-white/5 bg-transparent px-3 py-2 text-sm"
                            value={actionDrafts[action.id]?.dueDate || ''}
                            onChange={(event) => updateActionDraft(action.id, { dueDate: event.target.value })}
                          />
                        </div>
                        {action.blocking_flags.length > 0 && (
                          <div className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                            Flags: {action.blocking_flags.join(', ')}
                          </div>
                        )}
                        {action.error_message && (
                          <div className="mt-2 text-xs text-red-600 dark:text-red-300">
                            Error: {action.error_message}
                          </div>
                        )}
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="rounded-xl border border-black/10 dark:border-white/10 px-3 py-1.5 text-xs"
                            onClick={() => void handleSaveAction(action.id)}
                          >
                            Guardar cambios
                          </button>
                          <button
                            type="button"
                            className="rounded-xl border border-emerald-500/20 px-3 py-1.5 text-xs text-emerald-700 dark:text-emerald-300"
                            onClick={() => void handleApproveSingleAction(action.id)}
                          >
                            Aprobar esta accion
                          </button>
                        </div>
                        {action.approval_state !== 'rejected' && (
                          <button
                            type="button"
                            className="mt-3 rounded-xl border border-red-500/20 px-3 py-1.5 text-xs text-red-600 dark:text-red-300"
                            onClick={() => void handleRejectAction(action.id)}
                          >
                            Rechazar accion
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
