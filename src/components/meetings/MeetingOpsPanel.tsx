import { useEffect, useMemo, useState } from 'react';
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

const STATUS_STYLES: Record<string, string> = {
  SOURCE_IMPORTED: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20',
  EXTRACTING: 'bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/20',
  REVIEW_REQUIRED: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20',
  APPROVED: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  SYNCING: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
  SYNCED: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/20',
  CLOSED: 'bg-gray-500/15 text-gray-500 dark:text-gray-400 border-gray-500/20',
  FAILED_EXTRACTION: 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/20',
  BLOCKED_REVIEW: 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/20',
  SYNC_FAILED: 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/20',
};

const DESTINATION_STYLES: Record<string, { bg: string; text: string; icon: string }> = {
  IRIS: { bg: 'bg-violet-500/10', text: 'text-violet-600 dark:text-violet-400', icon: 'I' },
  'Project Hub': { bg: 'bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400', icon: 'P' },
  Team: { bg: 'bg-teal-500/10', text: 'text-teal-600 dark:text-teal-400', icon: 'T' },
  Project: { bg: 'bg-indigo-500/10', text: 'text-indigo-600 dark:text-indigo-400', icon: 'Pj' },
  None: { bg: 'bg-gray-500/10', text: 'text-gray-500', icon: '-' },
};

const PRIORITY_STYLES: Record<string, string> = {
  critical: 'bg-red-500/20 text-red-600 dark:text-red-300',
  high: 'bg-orange-500/20 text-orange-600 dark:text-orange-300',
  medium: 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-300',
  low: 'bg-gray-500/15 text-gray-500 dark:text-gray-400',
};

const SEVERITY_STYLES: Record<string, string> = {
  critical: 'bg-red-500/15 text-red-600 dark:text-red-400',
  high: 'bg-orange-500/15 text-orange-600 dark:text-orange-400',
  medium: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  low: 'bg-gray-500/15 text-gray-500 dark:text-gray-400',
};

function ConfidenceBar({ value, size = 'sm' }: { value: number; size?: 'sm' | 'lg' }) {
  const pct = Math.round(value * 100);
  const color = pct >= 85 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-500' : 'bg-red-500';
  const h = size === 'lg' ? 'h-1.5' : 'h-1';
  return (
    <div className="flex items-center gap-2">
      <div className={`flex-1 ${h} rounded-full bg-gray-200 dark:bg-white/[0.06] overflow-hidden`}>
        <div className={`${h} rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] tabular-nums text-gray-500 min-w-[32px] text-right">{pct}%</span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] || 'bg-gray-500/15 text-gray-400 border-gray-500/20';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium tracking-wide uppercase border ${style}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

function SectionTitle({ children, count }: { children: React.ReactNode; count?: number }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <h5 className="text-[13px] font-semibold text-gray-700 dark:text-gray-200 tracking-tight">{children}</h5>
      {typeof count === 'number' && (
        <span className="text-[10px] tabular-nums bg-gray-100 dark:bg-white/[0.06] text-gray-500 px-1.5 py-0.5 rounded-md">{count}</span>
      )}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-gray-200 dark:border-white/[0.06] py-6 flex items-center justify-center">
      <span className="text-[13px] text-gray-400 dark:text-gray-600">{text}</span>
    </div>
  );
}

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
  const [expandedAction, setExpandedAction] = useState<string | null>(null);

  useEffect(() => {
    void loadInitialData();
  }, [userId]);

  useEffect(() => {
    onMeetingDetected((event) => {
      if (event.ownerUserId !== userId) return;
      setNotice(`Nueva reunion detectada: ${event.meetingTitle || event.sourceFileName || 'Sin titulo'}.`);
      setSelectedRunId(event.runId);
      void loadInitialData();
      void loadRunDetail(event.runId);
    });
    return () => { removeMeetingListeners(); };
  }, [userId]);

  useEffect(() => {
    if (!selectedRunId) return;
    void loadRunDetail(selectedRunId);
  }, [selectedRunId]);

  useEffect(() => {
    if (!detail) { setActionDrafts({}); return; }
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
    return projects.filter((p) => !p.team_id || p.team_id === form.defaultTeamId);
  }, [projects, form.defaultTeamId]);

  const currentAnalysis = detail?.latest_asset?.payload.analysis_result || null;

  async function loadInitialData(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const [runsResult, contextResult] = await Promise.all([
        listMeetingRuns({ ownerUserId: userId, limit: 20 }),
        getMeetingContext(),
      ]);
      if (!runsResult.success) throw new Error(runsResult.error || 'No pude cargar los runs.');
      if (!contextResult.success) throw new Error(contextResult.error || 'No pude cargar el contexto de IRIS.');
      const nextRuns = runsResult.runs || [];
      setRuns(nextRuns);
      setTeams(contextResult.teams || []);
      setProjects(contextResult.projects || []);
      setTeamMembers(contextResult.teamMembers || []);
      if (!selectedRunId && nextRuns.length > 0) setSelectedRunId(nextRuns[0].run.id);
    } catch (err: any) {
      setError(err?.message || 'No pude cargar Meeting Ops.');
    } finally {
      setLoading(false);
    }
  }

  async function loadRunDetail(runId: string): Promise<void> {
    setError(null);
    const result = await getMeetingRunDetail(runId);
    if (!result.success || !result.detail) { setError(result.error || 'No pude cargar el detalle.'); return; }
    setDetail(result.detail);
  }

  async function handleCreateRun(): Promise<void> {
    setLoading(true); setError(null); setNotice(null);
    try {
      const base = {
        organizationId: organizationId || null, workspaceId: null, ownerUserId: userId,
        originChannel: 'app' as const, originRef: 'app:meeting-ops',
        meetingTitle: form.meetingTitle || null, meetingType: form.meetingType || 'general',
        defaultTeamId: form.defaultTeamId || null, defaultProjectId: form.defaultProjectId || null,
      };
      const result = mode === 'manual'
        ? await createManualMeetingRun({ ...base, text: form.manualText })
        : await createDriveMeetingRun({ ...base, fileIdOrUrl: form.driveRef });
      if (!result.success || !result.result) throw new Error(result.error || 'No pude crear el run.');
      await loadInitialData();
      setSelectedRunId(result.result.detail.run.id);
      setDetail(result.result.detail);
      setNotice(result.result.deduplicated ? 'Fuente reutilizada del run previo.' : 'Run creado correctamente.');
      setForm((c) => ({ ...c, manualText: '', driveRef: '' }));
    } catch (err: any) { setError(err?.message || 'No pude crear el run.'); }
    finally { setLoading(false); }
  }

  async function handleApproveAsset(): Promise<void> {
    if (!detail) return;
    const r = await approveMeetingAsset({ runId: detail.run.id, decidedByUserId: userId, comment: 'Aprobado desde la app' });
    if (!r.success || !r.detail) { setError(r.error || 'Error al aprobar.'); return; }
    setDetail(r.detail); setNotice('Resumen aprobado.'); await loadInitialData();
  }

  async function handleApproveActions(): Promise<void> {
    if (!detail) return;
    const r = await approveMeetingActions({ runId: detail.run.id, decidedByUserId: userId, comment: 'Acciones aprobadas' });
    if (!r.success || !r.detail) { setError(r.error || 'Error al aprobar acciones.'); return; }
    setDetail(r.detail); setNotice('Acciones aprobadas.'); await loadInitialData();
  }

  async function handleApproveSingleAction(actionId: string): Promise<void> {
    if (!detail) return;
    const r = await approveMeetingActions({ runId: detail.run.id, decidedByUserId: userId, actionIds: [actionId], comment: 'Aprobada' });
    if (!r.success || !r.detail) { setError(r.error || 'Error.'); return; }
    setDetail(r.detail); setNotice('Accion aprobada.'); await loadInitialData();
  }

  async function handleSaveAction(actionId: string): Promise<void> {
    const d = actionDrafts[actionId];
    if (!d) return;
    const r = await updateMeetingAction({ actionId, updates: { title: d.title, due_date: d.dueDate || null, team_id: d.teamId || null, project_id: d.projectId || null, assignee_id: d.assigneeId || null } });
    if (!r.success || !r.detail) { setError(r.error || 'Error al guardar.'); return; }
    setDetail(r.detail); setNotice('Accion actualizada.'); await loadInitialData();
  }

  async function handleRejectAction(actionId: string): Promise<void> {
    const r = await rejectMeetingAction({ actionId, decidedByUserId: userId, comment: 'Rechazada' });
    if (!r.success || !r.detail) { setError(r.error || 'Error al rechazar.'); return; }
    setDetail(r.detail); setNotice('Accion rechazada.'); await loadInitialData();
  }

  async function handleSyncActions(): Promise<void> {
    if (!detail) return;
    const r = await syncApprovedMeetingActions({ runId: detail.run.id, decidedByUserId: userId });
    if (!r.success || !r.detail) { setError(r.error || 'Error al sincronizar.'); return; }
    setDetail(r.detail);
    setNotice(`Sincronizadas: ${r.result?.synced || 0} | Fallidas: ${r.result?.failed || 0}`);
    await loadInitialData();
  }

  function updateActionDraft(actionId: string, patch: Partial<ActionDraft>): void {
    setActionDrafts((c) => ({ ...c, [actionId]: { ...(c[actionId] || { title: '', dueDate: '', teamId: '', projectId: '', assigneeId: '' }), ...patch } }));
  }

  function getProjectsForTeam(teamId: string): MeetingContextProject[] {
    if (!teamId) return projects;
    return projects.filter((p) => !p.team_id || p.team_id === teamId);
  }

  function getMembersForTeam(teamId: string): MeetingContextTeamMember[] {
    if (!teamId) return [];
    return teamMembers.filter((m) => m.team_id === teamId);
  }

  const inputClass = 'w-full rounded-lg border border-gray-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.03] px-3 py-2 text-sm text-gray-800 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-600 focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/20 transition';
  const selectClass = `${inputClass} appearance-none cursor-pointer`;

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="shrink-0 px-6 py-4 border-b border-gray-200 dark:border-white/[0.04]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
            <svg className="w-4 h-4 text-accent" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="2" y="3" width="12" height="11" rx="2" />
              <path d="M5 1v3M11 1v3M2 7h12" />
            </svg>
          </div>
          <div>
            <h3 className="text-[15px] font-semibold text-gray-900 dark:text-white tracking-tight">Meeting Ops</h3>
            <p className="text-[11px] text-gray-500 dark:text-gray-600">Importar, analizar y sincronizar reuniones</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex">
        {/* ─── Sidebar ─── */}
        <aside className="w-[340px] shrink-0 border-r border-gray-200 dark:border-white/[0.04] flex flex-col overflow-hidden">
          {/* Create form */}
          <div className="p-4 space-y-3 border-b border-gray-200 dark:border-white/[0.04]">
            <div className="flex rounded-lg bg-gray-100 dark:bg-white/[0.03] p-0.5">
              {(['manual', 'drive'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`flex-1 py-1.5 rounded-md text-[12px] font-medium transition ${mode === m ? 'bg-accent text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                  onClick={() => setMode(m)}
                >
                  {m === 'manual' ? 'Notas manuales' : 'Google Drive'}
                </button>
              ))}
            </div>

            <input className={inputClass} value={form.meetingTitle} onChange={(e) => setForm({ ...form, meetingTitle: e.target.value })} placeholder="Titulo de la reunion" />

            <div className="grid grid-cols-2 gap-2">
              <input className={inputClass} value={form.meetingType} onChange={(e) => setForm({ ...form, meetingType: e.target.value })} placeholder="Tipo" />
              <select className={selectClass} value={form.defaultTeamId} onChange={(e) => setForm({ ...form, defaultTeamId: e.target.value, defaultProjectId: '' })}>
                <option value="">Sin team</option>
                {teams.map((t) => <option key={t.team_id} value={t.team_id}>{t.name}</option>)}
              </select>
            </div>

            <select className={selectClass} value={form.defaultProjectId} onChange={(e) => setForm({ ...form, defaultProjectId: e.target.value })}>
              <option value="">Sin proyecto</option>
              {visibleProjects.map((p) => <option key={p.project_id} value={p.project_id}>{p.project_name}</option>)}
            </select>

            {mode === 'manual' ? (
              <textarea
                className={`${inputClass} min-h-[100px] resize-y`}
                value={form.manualText}
                onChange={(e) => setForm({ ...form, manualText: e.target.value })}
                placeholder="Pega aqui las notas, compromisos, decisiones y bloqueos..."
              />
            ) : (
              <input className={inputClass} value={form.driveRef} onChange={(e) => setForm({ ...form, driveRef: e.target.value })} placeholder="Link de Drive o ID de archivo" />
            )}

            <button
              type="button"
              className="w-full rounded-lg bg-accent hover:bg-accent/90 text-white py-2.5 text-[13px] font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed"
              onClick={() => void handleCreateRun()}
              disabled={loading || (mode === 'manual' ? !form.manualText.trim() : !form.driveRef.trim())}
            >
              {loading ? 'Procesando...' : 'Crear run'}
            </button>
          </div>

          {/* Runs list */}
          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            <div className="flex items-center justify-between px-1 mb-2">
              <span className="text-[11px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-600">Runs recientes</span>
              <button type="button" className="text-[11px] text-accent hover:text-accent/80 transition" onClick={() => void loadInitialData()}>Recargar</button>
            </div>

            {runs.length === 0 && <EmptyState text="No hay runs todavia" />}

            {runs.map((s) => {
              const isSelected = selectedRunId === s.run.id;
              return (
                <button
                  key={s.run.id}
                  type="button"
                  className={`w-full text-left rounded-xl p-3 transition-all ${isSelected ? 'bg-accent/[0.08] ring-1 ring-accent/20' : 'hover:bg-gray-50 dark:hover:bg-white/[0.02]'}`}
                  onClick={() => setSelectedRunId(s.run.id)}
                >
                  <div className="text-[13px] font-medium text-gray-800 dark:text-gray-200 leading-tight truncate">
                    {s.run.meeting_title || 'Sin titulo'}
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <StatusBadge status={s.run.status} />
                    <span className="text-[10px] text-gray-400 dark:text-gray-600">{new Date(s.run.created_at).toLocaleDateString()}</span>
                  </div>
                  {(s.counts.approved_actions > 0 || s.counts.synced_actions > 0) && (
                    <div className="mt-1.5 flex gap-3 text-[10px] text-gray-400 dark:text-gray-600">
                      {s.counts.approved_actions > 0 && <span>{s.counts.approved_actions} aprobadas</span>}
                      {s.counts.synced_actions > 0 && <span>{s.counts.synced_actions} sincronizadas</span>}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </aside>

        {/* ─── Main content ─── */}
        <main className="flex-1 overflow-y-auto">
          {/* Alerts */}
          <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm">
            {error && (
              <div className="mx-6 mt-3 rounded-lg border border-red-500/20 bg-red-500/[0.06] px-4 py-2.5 text-[13px] text-red-400 flex items-center gap-2">
                <span className="shrink-0 w-1 h-1 rounded-full bg-red-500" />
                {error}
                <button type="button" className="ml-auto text-red-500/60 hover:text-red-400" onClick={() => setError(null)}>x</button>
              </div>
            )}
            {notice && (
              <div className="mx-6 mt-3 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-2.5 text-[13px] text-emerald-400 flex items-center gap-2">
                <span className="shrink-0 w-1 h-1 rounded-full bg-emerald-500" />
                {notice}
                <button type="button" className="ml-auto text-emerald-500/60 hover:text-emerald-400" onClick={() => setNotice(null)}>x</button>
              </div>
            )}
          </div>

          {!detail && (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-gray-400 dark:text-gray-700">
              <svg className="w-10 h-10 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                <rect x="3" y="4" width="18" height="16" rx="3" />
                <path d="M8 2v3M16 2v3M3 9h18" />
              </svg>
              <span className="text-[13px]">Selecciona un run para ver el analisis</span>
            </div>
          )}

          {detail && (
            <div className="p-6 space-y-5">
              {/* ── Run header ── */}
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white tracking-tight truncate">
                    {detail.run.meeting_title || 'Reunion sin titulo'}
                  </h4>
                  <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                    <StatusBadge status={detail.run.status} />
                    <span className="text-[11px] text-gray-500 dark:text-gray-600">{detail.run.meeting_type}</span>
                    <span className="text-[11px] text-gray-300 dark:text-gray-700">|</span>
                    <span className="text-[11px] text-gray-500 dark:text-gray-600">{new Date(detail.run.created_at).toLocaleString()}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button type="button" className="rounded-lg px-3 py-1.5 text-[12px] font-medium border border-gray-200 dark:border-white/[0.06] text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:border-gray-300 dark:hover:border-white/10 transition" onClick={() => void handleApproveAsset()}>Aprobar resumen</button>
                  <button type="button" className="rounded-lg px-3 py-1.5 text-[12px] font-medium border border-gray-200 dark:border-white/[0.06] text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:border-gray-300 dark:hover:border-white/10 transition" onClick={() => void handleApproveActions()}>Aprobar acciones</button>
                  <button type="button" className="rounded-lg px-3 py-1.5 text-[12px] font-medium bg-accent text-white hover:bg-accent/90 transition" onClick={() => void handleSyncActions()}>Sincronizar</button>
                </div>
              </div>

              {/* ── Intelligence strip ── */}
              {currentAnalysis && (
                <div className="grid grid-cols-3 gap-3">
                  {/* Classification */}
                  <div className="rounded-xl bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.04] p-4">
                    <div className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-600 mb-2">Clasificacion</div>
                    <div className="text-[14px] font-semibold text-gray-900 dark:text-white mb-1">
                      {currentAnalysis.meetingType.suggestedType.replace(/_/g, ' ')}
                    </div>
                    <ConfidenceBar value={currentAnalysis.meetingType.confidence} size="lg" />
                    <p className="mt-2 text-[12px] leading-relaxed text-gray-500 dark:text-gray-500">{currentAnalysis.meetingType.reason}</p>
                    {currentAnalysis.meetingType.alternativeTypes.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {currentAnalysis.meetingType.alternativeTypes.map((alt) => (
                          <span key={alt.type} className="inline-flex items-center gap-1 text-[10px] bg-gray-100 dark:bg-white/[0.04] text-gray-500 px-1.5 py-0.5 rounded">
                            {alt.type.replace(/_/g, ' ')}
                            <span className="text-gray-400 dark:text-gray-700">{Math.round(alt.confidence * 100)}%</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Routing */}
                  <div className="rounded-xl bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.04] p-4">
                    <div className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-600 mb-2">Destino recomendado</div>
                    {(() => {
                      const dest = currentAnalysis.destinationRecommendation.suggestedDestination;
                      const ds = DESTINATION_STYLES[dest] || DESTINATION_STYLES.None;
                      return (
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`w-7 h-7 rounded-lg ${ds.bg} ${ds.text} flex items-center justify-center text-[11px] font-bold`}>{ds.icon}</span>
                          <span className="text-[14px] font-semibold text-gray-900 dark:text-white">{dest}</span>
                        </div>
                      );
                    })()}
                    <ConfidenceBar value={currentAnalysis.destinationRecommendation.confidence} size="lg" />
                    <p className="mt-2 text-[12px] leading-relaxed text-gray-500 dark:text-gray-500">{currentAnalysis.destinationRecommendation.reason}</p>
                    <div className="mt-3 pt-2 border-t border-gray-100 dark:border-white/[0.04]">
                      <div className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-700 mb-1">Follow-up</div>
                      {currentAnalysis.followUpRecommendation.suggested ? (
                        <div className="flex items-start gap-1.5">
                          <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                          <span className="text-[12px] text-gray-400">{currentAnalysis.followUpRecommendation.description || currentAnalysis.followUpRecommendation.type || 'Sugerido'}</span>
                        </div>
                      ) : (
                        <span className="text-[12px] text-gray-400 dark:text-gray-700">No requerido</span>
                      )}
                    </div>
                  </div>

                  {/* Governance */}
                  <div className="rounded-xl bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.04] p-4">
                    <div className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-600 mb-2">Gobernanza</div>
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[12px] text-gray-500 dark:text-gray-500">Nivel de autonomia</span>
                        <div className="flex gap-0.5">
                          {[0, 1, 2, 3, 4].map((n) => (
                            <div key={n} className={`w-5 h-1.5 rounded-sm ${n <= currentAnalysis.governance.autonomyLevelApplied ? 'bg-accent' : 'bg-gray-200 dark:bg-white/[0.06]'}`} />
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[12px] text-gray-500 dark:text-gray-500">Aprobacion humana</span>
                        <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${currentAnalysis.governance.requiresHumanApproval ? 'bg-amber-500/15 text-amber-400' : 'bg-emerald-500/15 text-emerald-400'}`}>
                          {currentAnalysis.governance.requiresHumanApproval ? 'Requerida' : 'No requerida'}
                        </span>
                      </div>
                      {currentAnalysis.governance.sensitiveActionsBlocked.length > 0 && (
                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-700 mb-1.5">Acciones bloqueadas</div>
                          <div className="space-y-1">
                            {currentAnalysis.governance.sensitiveActionsBlocked.slice(0, 3).map((a, i) => (
                              <div key={i} className="flex items-start gap-1.5 text-[11px] text-gray-500 dark:text-gray-600">
                                <span className="mt-1 w-1 h-1 rounded-full bg-red-500/60 shrink-0" />
                                {a}
                              </div>
                            ))}
                            {currentAnalysis.governance.sensitiveActionsBlocked.length > 3 && (
                              <span className="text-[10px] text-gray-400 dark:text-gray-700">+{currentAnalysis.governance.sensitiveActionsBlocked.length - 3} mas</span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ── Summaries ── */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.04] p-4">
                  <div className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-600 mb-2">Resumen ejecutivo</div>
                  <p className="text-[13px] leading-relaxed text-gray-600 dark:text-gray-300">
                    {detail.latest_asset?.executive_summary || 'Sin resumen ejecutivo.'}
                  </p>
                </div>
                <div className="rounded-xl bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.04] p-4">
                  <div className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-600 mb-2">Resumen operativo</div>
                  <p className="text-[13px] leading-relaxed text-gray-600 dark:text-gray-300">
                    {detail.latest_asset?.operational_summary || 'Sin resumen operativo.'}
                  </p>
                </div>
              </div>

              {/* ── Key points ── */}
              {currentAnalysis && currentAnalysis.keyPoints.length > 0 && (
                <div className="rounded-xl bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.04] p-4">
                  <SectionTitle count={currentAnalysis.keyPoints.length}>Puntos clave</SectionTitle>
                  <div className="grid grid-cols-2 gap-2">
                    {currentAnalysis.keyPoints.map((point, i) => (
                      <div key={i} className="flex items-start gap-2 text-[12px] text-gray-400">
                        <span className="mt-1.5 w-1 h-1 rounded-full bg-accent/60 shrink-0" />
                        {point}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Three-column: Tasks | Risks+Questions | Actions ── */}
              <div className="grid grid-cols-3 gap-3">
                {/* Tasks */}
                <div className="rounded-xl bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.04] p-4">
                  <SectionTitle count={(currentAnalysis?.tasks || detail.latest_asset?.payload.commitments || []).length}>Tareas</SectionTitle>
                  <div className="space-y-2">
                    {(currentAnalysis?.tasks || []).length === 0 && (detail.latest_asset?.payload.commitments || []).length === 0 && (
                      <EmptyState text="Sin tareas detectadas" />
                    )}
                    {(currentAnalysis?.tasks || []).map((task, i) => (
                      <div key={i} className="rounded-lg bg-gray-50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/[0.04] p-3 space-y-2">
                        <div className="text-[13px] text-gray-700 dark:text-gray-200 leading-snug">{task.description}</div>
                        <div className="flex flex-wrap gap-1.5">
                          {task.prioritySuggested && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${PRIORITY_STYLES[task.prioritySuggested] || PRIORITY_STYLES.medium}`}>
                              {task.prioritySuggested}
                            </span>
                          )}
                          {task.ownerSuggested && (
                            <span className="text-[10px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded">{task.ownerSuggested}</span>
                          )}
                          {task.dueDateSuggested && (
                            <span className="text-[10px] bg-gray-100 dark:bg-white/[0.04] text-gray-500 px-1.5 py-0.5 rounded">{task.dueDateSuggested}</span>
                          )}
                          {task.requiresHumanReview && (
                            <span className="text-[10px] bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded">Rev. humana</span>
                          )}
                        </div>
                        <ConfidenceBar value={task.confidence} />
                        <div className="text-[11px] text-gray-500 dark:text-gray-600 leading-snug">{task.reason}</div>
                      </div>
                    ))}
                    {!currentAnalysis && (detail.latest_asset?.payload.commitments || []).map((c, i) => (
                      <div key={i} className="rounded-lg bg-gray-50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/[0.04] p-3">
                        <div className="text-[13px] text-gray-200">{c.statement}</div>
                        <div className="mt-1.5 flex gap-1.5 text-[10px]">
                          {c.owner_candidate && <span className="bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded">{c.owner_candidate}</span>}
                          {c.due_date_candidate && <span className="bg-gray-100 dark:bg-white/[0.04] text-gray-500 px-1.5 py-0.5 rounded">{c.due_date_candidate}</span>}
                          <span className="bg-gray-100 dark:bg-white/[0.04] text-gray-500 dark:text-gray-600 px-1.5 py-0.5 rounded">{c.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Risks + Questions */}
                <div className="rounded-xl bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.04] p-4">
                  <SectionTitle count={(currentAnalysis?.risks.length || 0) + (currentAnalysis?.openQuestions.length || 0) + (detail.latest_asset?.review_flags.length || 0)}>
                    Riesgos y preguntas
                  </SectionTitle>
                  <div className="space-y-2">
                    {currentAnalysis?.risks.map((risk, i) => (
                      <div key={`r-${i}`} className="rounded-lg bg-red-500/[0.03] border border-red-500/10 p-3">
                        <div className="flex items-start gap-2">
                          <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                          <div>
                            <div className="text-[13px] text-gray-700 dark:text-gray-200 leading-snug">{risk.description}</div>
                            <div className="mt-1.5 flex items-center gap-2">
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${SEVERITY_STYLES[risk.severity || 'medium']}`}>{risk.severity || 'medium'}</span>
                              <ConfidenceBar value={risk.confidence} />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}

                    {currentAnalysis?.openQuestions.map((q, i) => (
                      <div key={`q-${i}`} className="rounded-lg bg-blue-500/[0.03] border border-blue-500/10 p-3">
                        <div className="flex items-start gap-2">
                          <span className="mt-1 text-blue-500 text-[12px] font-bold shrink-0">?</span>
                          <div>
                            <div className="text-[13px] text-gray-700 dark:text-gray-200 leading-snug">{q.question}</div>
                            <div className="mt-1.5">
                              <ConfidenceBar value={q.confidence} />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}

                    {(detail.latest_asset?.review_flags || []).map((flag, i) => (
                      <div key={`f-${i}`} className="rounded-lg bg-amber-500/[0.03] border border-amber-500/10 p-2.5 flex items-start gap-2">
                        <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                        <div>
                          <div className="text-[11px] font-medium text-amber-400">{flag.code.replace(/_/g, ' ')}</div>
                          <div className="text-[11px] text-gray-500 dark:text-gray-600">{flag.message}</div>
                        </div>
                      </div>
                    ))}

                    {(currentAnalysis?.risks || []).length === 0 && (currentAnalysis?.openQuestions || []).length === 0 && (detail.latest_asset?.review_flags || []).length === 0 && (
                      <div className="rounded-lg bg-emerald-500/[0.03] border border-emerald-500/10 p-3 text-center">
                        <span className="text-[12px] text-emerald-500">Sin riesgos ni preguntas abiertas</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Sync Actions */}
                <div className="rounded-xl bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.04] p-4">
                  <SectionTitle count={detail.sync_actions.length}>Acciones propuestas</SectionTitle>
                  <div className="space-y-2">
                    {detail.sync_actions.length === 0 && <EmptyState text="Sin acciones propuestas" />}

                    {detail.sync_actions.map((action) => {
                      const isExpanded = expandedAction === action.id;
                      const approvalColor = action.approval_state === 'approved' ? 'text-emerald-400' : action.approval_state === 'rejected' ? 'text-red-400' : 'text-gray-500';
                      return (
                        <div key={action.id} className="rounded-lg bg-gray-50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/[0.04] overflow-hidden">
                          <button
                            type="button"
                            className="w-full text-left p-3 hover:bg-gray-50 dark:hover:bg-white/[0.01] transition"
                            onClick={() => setExpandedAction(isExpanded ? null : action.id)}
                          >
                            <div className="text-[13px] text-gray-700 dark:text-gray-200 leading-snug">{action.summary}</div>
                            <div className="mt-1.5 flex items-center gap-2">
                              <span className={`text-[10px] font-medium ${approvalColor}`}>{action.approval_state}</span>
                              <span className="text-[10px] text-gray-300 dark:text-gray-700">|</span>
                              <span className="text-[10px] text-gray-500 dark:text-gray-600">{action.sync_state}</span>
                              {action.payload.owner_candidate && (
                                <span className="text-[10px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded">{action.payload.owner_candidate}</span>
                              )}
                            </div>
                            {action.blocking_flags.length > 0 && (
                              <div className="mt-1.5 flex flex-wrap gap-1">
                                {action.blocking_flags.map((f) => (
                                  <span key={f} className="text-[9px] bg-amber-500/15 text-amber-400 px-1 py-0.5 rounded">{f.replace(/_/g, ' ')}</span>
                                ))}
                              </div>
                            )}
                            {action.error_message && <div className="mt-1 text-[11px] text-red-400">{action.error_message}</div>}
                          </button>

                          {isExpanded && (
                            <div className="px-3 pb-3 space-y-2 border-t border-gray-100 dark:border-white/[0.04] pt-3">
                              <input className={inputClass} value={actionDrafts[action.id]?.title || ''} onChange={(e) => updateActionDraft(action.id, { title: e.target.value })} placeholder="Titulo" />
                              <div className="grid grid-cols-2 gap-2">
                                <select className={selectClass} value={actionDrafts[action.id]?.teamId || ''} onChange={(e) => updateActionDraft(action.id, { teamId: e.target.value, projectId: '', assigneeId: '' })}>
                                  <option value="">Sin team</option>
                                  {teams.map((t) => <option key={t.team_id} value={t.team_id}>{t.name}</option>)}
                                </select>
                                <select className={selectClass} value={actionDrafts[action.id]?.projectId || ''} onChange={(e) => updateActionDraft(action.id, { projectId: e.target.value })}>
                                  <option value="">Sin proyecto</option>
                                  {getProjectsForTeam(actionDrafts[action.id]?.teamId || '').map((p) => <option key={p.project_id} value={p.project_id}>{p.project_name}</option>)}
                                </select>
                              </div>
                              <select className={selectClass} value={actionDrafts[action.id]?.assigneeId || ''} onChange={(e) => updateActionDraft(action.id, { assigneeId: e.target.value })}>
                                <option value="">Sin responsable</option>
                                {getMembersForTeam(actionDrafts[action.id]?.teamId || '').map((m) => (
                                  <option key={m.membership_id} value={m.user_id}>{m.display_name || m.username || m.email || m.user_id}</option>
                                ))}
                              </select>
                              <input type="date" className={inputClass} value={actionDrafts[action.id]?.dueDate || ''} onChange={(e) => updateActionDraft(action.id, { dueDate: e.target.value })} />
                              <div className="flex gap-1.5 pt-1">
                                <button type="button" className="flex-1 rounded-lg border border-gray-200 dark:border-white/[0.06] py-1.5 text-[11px] text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:border-gray-300 dark:hover:border-white/10 transition" onClick={() => void handleSaveAction(action.id)}>Guardar</button>
                                <button type="button" className="flex-1 rounded-lg border border-emerald-500/20 py-1.5 text-[11px] text-emerald-400 hover:bg-emerald-500/[0.06] transition" onClick={() => void handleApproveSingleAction(action.id)}>Aprobar</button>
                                {action.approval_state !== 'rejected' && (
                                  <button type="button" className="rounded-lg border border-red-500/20 py-1.5 px-3 text-[11px] text-red-400 hover:bg-red-500/[0.06] transition" onClick={() => void handleRejectAction(action.id)}>Rechazar</button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* ── Decisions + Agreements ── */}
              {currentAnalysis && (currentAnalysis.decisions.length > 0 || currentAnalysis.agreements.length > 0) && (
                <div className="grid grid-cols-2 gap-3">
                  {currentAnalysis.decisions.length > 0 && (
                    <div className="rounded-xl bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.04] p-4">
                      <SectionTitle count={currentAnalysis.decisions.length}>Decisiones</SectionTitle>
                      <div className="space-y-2">
                        {currentAnalysis.decisions.map((d, i) => (
                          <div key={i} className="rounded-lg bg-violet-500/[0.03] border border-violet-500/10 p-3">
                            <div className="text-[13px] text-gray-700 dark:text-gray-200 leading-snug">{d.description}</div>
                            <div className="mt-1.5"><ConfidenceBar value={d.confidence} /></div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {currentAnalysis.agreements.length > 0 && (
                    <div className="rounded-xl bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.04] p-4">
                      <SectionTitle count={currentAnalysis.agreements.length}>Acuerdos</SectionTitle>
                      <div className="space-y-2">
                        {currentAnalysis.agreements.map((a, i) => (
                          <div key={i} className="rounded-lg bg-teal-500/[0.03] border border-teal-500/10 p-3">
                            <div className="text-[13px] text-gray-700 dark:text-gray-200 leading-snug">{a.description}</div>
                            <div className="mt-1.5"><ConfidenceBar value={a.confidence} /></div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── Unresolved items ── */}
              {currentAnalysis && currentAnalysis.unresolvedItems.length > 0 && (
                <div className="rounded-xl bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.04] p-4">
                  <SectionTitle count={currentAnalysis.unresolvedItems.length}>Temas pendientes</SectionTitle>
                  <div className="grid grid-cols-2 gap-2">
                    {currentAnalysis.unresolvedItems.map((item, i) => (
                      <div key={i} className="rounded-lg bg-orange-500/[0.03] border border-orange-500/10 p-3">
                        <div className="text-[13px] text-gray-700 dark:text-gray-200 leading-snug">{item.item}</div>
                        <div className="mt-1 text-[11px] text-gray-500 dark:text-gray-600">{item.reasonOpen}</div>
                        <div className="mt-1.5"><ConfidenceBar value={item.confidence} /></div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
