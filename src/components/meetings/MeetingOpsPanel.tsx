import React from 'react';
import { ConfidenceBar, EmptyState, SectionTitle, StatusBadge } from './meeting-ops-panel/base-components';
import { CreateRunForm } from './meeting-ops-panel/CreateRunForm';
import { PanelHeader } from './meeting-ops-panel/PanelHeader';
import { DESTINATION_STYLES, PRIORITY_STYLES, SEVERITY_STYLES } from './meeting-ops-panel/styles';
import type { MeetingOpsPanelProps } from './meeting-ops-panel/types';
import { useMeetingOpsState } from './meeting-ops-panel/useMeetingOpsState';

export const MeetingOpsPanel: React.FC<MeetingOpsPanelProps> = ({ userId, organizationId }) => {
  const {
    mode, setMode, form, setForm, runs, selectedRunId, setSelectedRunId, detail,
    actionDrafts, teams, loading, error, setError, notice, setNotice, expandedAction,
    setExpandedAction, visibleProjects, currentAnalysis, handleCreateRun, loadInitialData,
    handleApproveAsset, handleApproveActions, handleApproveSingleAction, handleSaveAction,
    handleRejectAction, handleSyncActions, updateActionDraft, getProjectsForTeam, getMembersForTeam,
  } = useMeetingOpsState({ userId, organizationId: organizationId ?? undefined });

  const inputClass = 'w-full rounded-lg border border-gray-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.03] px-3 py-2 text-sm text-gray-800 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-600 focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/20 transition';
  const selectClass = `${inputClass} appearance-none cursor-pointer`;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <PanelHeader
        error={error}
        loading={loading}
        notice={notice}
        onReload={() => void loadInitialData()}
        setError={setError}
        setNotice={setNotice}
      />

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto no-scrollbar">
        <CreateRunForm
          form={form}
          handleCreateRun={handleCreateRun}
          inputClass={inputClass}
          loading={loading}
          mode={mode}
          selectClass={selectClass}
          setForm={setForm}
          setMode={setMode}
          teams={teams}
          visibleProjects={visibleProjects}
        />

        {/* ── Runs list ── */}
        <section className="px-6 pb-6 border-t border-gray-200 dark:border-white/[0.05] pt-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-bold text-gray-900 dark:text-white">Runs recientes</p>
            {runs.filter((s) => s.run.status === 'REVIEW_REQUIRED').length > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/20">
                {runs.filter((s) => s.run.status === 'REVIEW_REQUIRED').length} por revisar
              </span>
            )}
          </div>

          {runs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 dark:border-white/[0.06] px-4 py-10 text-center text-xs text-gray-500 dark:text-gray-500">
              No hay runs todavia. Crea uno arriba para empezar.
            </div>
          ) : (
            <div className="space-y-3">
              {/* Run cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {runs.map((s) => (
                  <button key={s.run.id} type="button"
                    onClick={() => setSelectedRunId(selectedRunId === s.run.id ? null : s.run.id)}
                    className={`w-full text-left rounded-xl border px-4 py-3 transition-all ${
                      selectedRunId === s.run.id
                        ? 'border-accent/30 bg-accent/8 shadow-md ring-1 ring-accent/10'
                        : 'border-gray-200 dark:border-white/[0.06] hover:border-accent/20 bg-white dark:bg-white/[0.02]'
                    }`}>
                    <p className="text-[12px] font-semibold text-gray-900 dark:text-white leading-tight truncate">{s.run.meeting_title || 'Sin titulo'}</p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <StatusBadge status={s.run.status} />
                      <span className="text-[10px] text-gray-400 dark:text-gray-500">{new Date(s.run.created_at).toLocaleDateString()}</span>
                    </div>
                    {(s.counts.approved_actions > 0 || s.counts.synced_actions > 0) && (
                      <div className="mt-1.5 flex gap-3 text-[10px] text-gray-400 dark:text-gray-500">
                        {s.counts.approved_actions > 0 && <span>{s.counts.approved_actions} aprobadas</span>}
                        {s.counts.synced_actions > 0 && <span>{s.counts.synced_actions} sincronizadas</span>}
                      </div>
                    )}
                  </button>
                ))}
              </div>

              {/* ── Inline run detail ── */}
              {detail && (
                <div className="mt-4 space-y-4">
                  {/* Run header */}
                  <div className="bg-white dark:bg-[#1a1c20]/50 backdrop-blur-sm border border-gray-200 dark:border-white/10 rounded-2xl p-5 shadow-sm dark:shadow-lg">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-base font-bold text-gray-900 dark:text-white tracking-tight">{detail.run.meeting_title || 'Reunion sin titulo'}</p>
                        <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                          <StatusBadge status={detail.run.status} />
                          <span className="text-[11px] text-gray-500 dark:text-gray-400">{detail.run.meeting_type}</span>
                          <span className="text-[11px] text-gray-400 dark:text-gray-500">{new Date(detail.run.created_at).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className="rounded-xl px-4 py-2 text-[12px] font-medium border border-gray-200 dark:border-white/[0.06] text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:border-gray-300 dark:hover:border-white/10 transition" onClick={() => void handleApproveAsset()}>Aprobar resumen</button>
                      <button type="button" className="rounded-xl px-4 py-2 text-[12px] font-medium border border-gray-200 dark:border-white/[0.06] text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:border-gray-300 dark:hover:border-white/10 transition" onClick={() => void handleApproveActions()}>Aprobar acciones</button>
                      <button type="button" className="rounded-xl px-4 py-2 text-[12px] font-medium bg-accent text-white hover:bg-accent/90 transition" onClick={() => void handleSyncActions()}>Sincronizar</button>
                    </div>
                  </div>

                  {/* Intelligence strip */}
                  {currentAnalysis && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {/* Classification */}
                      <div className="rounded-2xl bg-white dark:bg-[#1a1c20]/50 border border-gray-200 dark:border-white/10 p-5 shadow-sm dark:shadow-lg">
                        <div className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">Clasificacion</div>
                        <div className="text-[14px] font-semibold text-gray-900 dark:text-white mb-1">
                          {currentAnalysis.meetingType.suggestedType.replace(/_/g, ' ')}
                        </div>
                        <ConfidenceBar value={currentAnalysis.meetingType.confidence} size="lg" />
                        <p className="mt-2 text-[12px] leading-relaxed text-gray-500 dark:text-gray-400">{currentAnalysis.meetingType.reason}</p>
                        {currentAnalysis.meetingType.alternativeTypes.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {currentAnalysis.meetingType.alternativeTypes.map((alt) => (
                              <span key={alt.type} className="inline-flex items-center gap-1 text-[10px] bg-gray-100 dark:bg-white/[0.04] text-gray-500 px-1.5 py-0.5 rounded">
                                {alt.type.replace(/_/g, ' ')}
                                <span className="text-gray-400 dark:text-gray-600">{Math.round(alt.confidence * 100)}%</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Routing */}
                      <div className="rounded-2xl bg-white dark:bg-[#1a1c20]/50 border border-gray-200 dark:border-white/10 p-5 shadow-sm dark:shadow-lg">
                        <div className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">Destino recomendado</div>
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
                        <p className="mt-2 text-[12px] leading-relaxed text-gray-500 dark:text-gray-400">{currentAnalysis.destinationRecommendation.reason}</p>
                        <div className="mt-3 pt-2 border-t border-gray-100 dark:border-white/[0.04]">
                          <div className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1">Follow-up</div>
                          {currentAnalysis.followUpRecommendation.suggested ? (
                            <div className="flex items-start gap-1.5">
                              <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                              <span className="text-[12px] text-gray-500 dark:text-gray-400">{currentAnalysis.followUpRecommendation.description || currentAnalysis.followUpRecommendation.type || 'Sugerido'}</span>
                            </div>
                          ) : (
                            <span className="text-[12px] text-gray-400 dark:text-gray-500">No requerido</span>
                          )}
                        </div>
                      </div>

                      {/* Governance */}
                      <div className="rounded-2xl bg-white dark:bg-[#1a1c20]/50 border border-gray-200 dark:border-white/10 p-5 shadow-sm dark:shadow-lg">
                        <div className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">Gobernanza</div>
                        <div className="space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[12px] text-gray-500 dark:text-gray-400">Nivel de autonomia</span>
                            <div className="flex gap-0.5">
                              {[0, 1, 2, 3, 4].map((n) => (
                                <div key={n} className={`w-5 h-1.5 rounded-sm ${n <= currentAnalysis.governance.autonomyLevelApplied ? 'bg-accent' : 'bg-gray-200 dark:bg-white/[0.06]'}`} />
                              ))}
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[12px] text-gray-500 dark:text-gray-400">Aprobacion humana</span>
                            <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${currentAnalysis.governance.requiresHumanApproval ? 'bg-amber-500/15 text-amber-400' : 'bg-emerald-500/15 text-emerald-400'}`}>
                              {currentAnalysis.governance.requiresHumanApproval ? 'Requerida' : 'No requerida'}
                            </span>
                          </div>
                          {currentAnalysis.governance.sensitiveActionsBlocked.length > 0 && (
                            <div>
                              <div className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1.5">Acciones bloqueadas</div>
                              <div className="space-y-1">
                                {currentAnalysis.governance.sensitiveActionsBlocked.slice(0, 3).map((a, i) => (
                                  <div key={i} className="flex items-start gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
                                    <span className="mt-1 w-1 h-1 rounded-full bg-red-500/60 shrink-0" />
                                    {a}
                                  </div>
                                ))}
                                {currentAnalysis.governance.sensitiveActionsBlocked.length > 3 && (
                                  <span className="text-[10px] text-gray-400 dark:text-gray-500">+{currentAnalysis.governance.sensitiveActionsBlocked.length - 3} mas</span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Summaries */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-white dark:bg-[#1a1c20]/50 border border-gray-200 dark:border-white/10 p-5 shadow-sm dark:shadow-lg">
                      <div className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">Resumen ejecutivo</div>
                      <p className="text-[13px] leading-relaxed text-gray-600 dark:text-gray-300">
                        {detail.latest_asset?.executive_summary || 'Sin resumen ejecutivo.'}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-white dark:bg-[#1a1c20]/50 border border-gray-200 dark:border-white/10 p-5 shadow-sm dark:shadow-lg">
                      <div className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">Resumen operativo</div>
                      <p className="text-[13px] leading-relaxed text-gray-600 dark:text-gray-300">
                        {detail.latest_asset?.operational_summary || 'Sin resumen operativo.'}
                      </p>
                    </div>
                  </div>

                  {/* Key points */}
                  {currentAnalysis && currentAnalysis.keyPoints.length > 0 && (
                    <div className="rounded-2xl bg-white dark:bg-[#1a1c20]/50 border border-gray-200 dark:border-white/10 p-5 shadow-sm dark:shadow-lg">
                      <SectionTitle count={currentAnalysis.keyPoints.length}>Puntos clave</SectionTitle>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {currentAnalysis.keyPoints.map((point, i) => (
                          <div key={i} className="flex items-start gap-2 text-[12px] text-gray-600 dark:text-gray-300">
                            <span className="mt-1.5 w-1 h-1 rounded-full bg-accent/60 shrink-0" />
                            {point}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Tasks + Risks + Actions — stacked instead of 3-col */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {/* Tasks */}
                    <div className="rounded-2xl bg-white dark:bg-[#1a1c20]/50 border border-gray-200 dark:border-white/10 p-5 shadow-sm dark:shadow-lg">
                      <SectionTitle count={(currentAnalysis?.tasks || detail.latest_asset?.payload.commitments || []).length}>Tareas</SectionTitle>
                      <div className="space-y-2">
                        {(currentAnalysis?.tasks || []).length === 0 && (detail.latest_asset?.payload.commitments || []).length === 0 && (
                          <EmptyState text="Sin tareas detectadas" />
                        )}
                        {(currentAnalysis?.tasks || []).map((task, i) => (
                          <div key={i} className="rounded-xl bg-gray-50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/[0.04] p-3 space-y-2">
                            <div className="text-[13px] text-gray-700 dark:text-gray-200 leading-snug">{task.description}</div>
                            <div className="flex flex-wrap gap-1.5">
                              {task.prioritySuggested && (
                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${PRIORITY_STYLES[task.prioritySuggested] || PRIORITY_STYLES.medium}`}>
                                  {task.prioritySuggested}
                                </span>
                              )}
                              {task.ownerSuggested && <span className="text-[10px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded">{task.ownerSuggested}</span>}
                              {task.dueDateSuggested && <span className="text-[10px] bg-gray-100 dark:bg-white/[0.04] text-gray-500 px-1.5 py-0.5 rounded">{task.dueDateSuggested}</span>}
                              {task.requiresHumanReview && <span className="text-[10px] bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded">Rev. humana</span>}
                            </div>
                            <ConfidenceBar value={task.confidence} />
                            <div className="text-[11px] text-gray-500 dark:text-gray-400 leading-snug">{task.reason}</div>
                          </div>
                        ))}
                        {!currentAnalysis && (detail.latest_asset?.payload.commitments || []).map((c, i) => (
                          <div key={i} className="rounded-xl bg-gray-50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/[0.04] p-3">
                            <div className="text-[13px] text-gray-700 dark:text-gray-200">{c.statement}</div>
                            <div className="mt-1.5 flex gap-1.5 text-[10px]">
                              {c.owner_candidate && <span className="bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded">{c.owner_candidate}</span>}
                              {c.due_date_candidate && <span className="bg-gray-100 dark:bg-white/[0.04] text-gray-500 px-1.5 py-0.5 rounded">{c.due_date_candidate}</span>}
                              <span className="bg-gray-100 dark:bg-white/[0.04] text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded">{c.status}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Risks + Questions */}
                    <div className="rounded-2xl bg-white dark:bg-[#1a1c20]/50 border border-gray-200 dark:border-white/10 p-5 shadow-sm dark:shadow-lg">
                      <SectionTitle count={(currentAnalysis?.risks.length || 0) + (currentAnalysis?.openQuestions.length || 0) + (detail.latest_asset?.review_flags.length || 0)}>
                        Riesgos y preguntas
                      </SectionTitle>
                      <div className="space-y-2">
                        {currentAnalysis?.risks.map((risk, i) => (
                          <div key={`r-${i}`} className="rounded-xl bg-red-500/[0.03] border border-red-500/10 p-3">
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
                          <div key={`q-${i}`} className="rounded-xl bg-blue-500/[0.03] border border-blue-500/10 p-3">
                            <div className="flex items-start gap-2">
                              <span className="mt-1 text-blue-500 text-[12px] font-bold shrink-0">?</span>
                              <div>
                                <div className="text-[13px] text-gray-700 dark:text-gray-200 leading-snug">{q.question}</div>
                                <div className="mt-1.5"><ConfidenceBar value={q.confidence} /></div>
                              </div>
                            </div>
                          </div>
                        ))}
                        {(detail.latest_asset?.review_flags || []).map((flag, i) => (
                          <div key={`f-${i}`} className="rounded-xl bg-amber-500/[0.03] border border-amber-500/10 p-2.5 flex items-start gap-2">
                            <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                            <div>
                              <div className="text-[11px] font-medium text-amber-600 dark:text-amber-400">{flag.code.replace(/_/g, ' ')}</div>
                              <div className="text-[11px] text-gray-500 dark:text-gray-400">{flag.message}</div>
                            </div>
                          </div>
                        ))}
                        {(currentAnalysis?.risks || []).length === 0 && (currentAnalysis?.openQuestions || []).length === 0 && (detail.latest_asset?.review_flags || []).length === 0 && (
                          <div className="rounded-xl bg-emerald-500/[0.03] border border-emerald-500/10 p-3 text-center">
                            <span className="text-[12px] text-emerald-600 dark:text-emerald-400">Sin riesgos ni preguntas abiertas</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Sync Actions — full width */}
                  <div className="rounded-2xl bg-white dark:bg-[#1a1c20]/50 border border-gray-200 dark:border-white/10 p-5 shadow-sm dark:shadow-lg">
                    <SectionTitle count={detail.sync_actions.length}>Acciones propuestas</SectionTitle>
                    <div className="space-y-2">
                      {detail.sync_actions.length === 0 && <EmptyState text="Sin acciones propuestas" />}
                      {detail.sync_actions.map((action) => {
                        const isExpanded = expandedAction === action.id;
                        const approvalColor = action.approval_state === 'approved' ? 'text-emerald-600 dark:text-emerald-400' : action.approval_state === 'rejected' ? 'text-red-600 dark:text-red-400' : 'text-gray-500';
                        return (
                          <div key={action.id} className="rounded-xl bg-gray-50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/[0.04] overflow-hidden">
                            <button type="button"
                              className="w-full text-left p-3 hover:bg-gray-100 dark:hover:bg-white/[0.01] transition"
                              onClick={() => setExpandedAction(isExpanded ? null : action.id)}>
                              <div className="text-[13px] text-gray-700 dark:text-gray-200 leading-snug">{action.summary}</div>
                              <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                                <span className={`text-[10px] font-medium ${approvalColor}`}>{action.approval_state}</span>
                                <span className="text-[10px] text-gray-300 dark:text-gray-600">|</span>
                                <span className="text-[10px] text-gray-500 dark:text-gray-400">{action.sync_state}</span>
                                {action.payload.owner_candidate && (
                                  <span className="text-[10px] bg-blue-500/10 text-blue-500 dark:text-blue-400 px-1.5 py-0.5 rounded">{action.payload.owner_candidate}</span>
                                )}
                              </div>
                              {action.blocking_flags.length > 0 && (
                                <div className="mt-1.5 flex flex-wrap gap-1">
                                  {action.blocking_flags.map((f) => (
                                    <span key={f} className="text-[9px] bg-amber-500/15 text-amber-600 dark:text-amber-400 px-1 py-0.5 rounded">{f.replace(/_/g, ' ')}</span>
                                  ))}
                                </div>
                              )}
                              {action.error_message && <div className="mt-1 text-[11px] text-red-500 dark:text-red-400">{action.error_message}</div>}
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
                                  <button type="button" className="flex-1 rounded-xl border border-gray-200 dark:border-white/[0.06] py-1.5 text-[11px] text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition" onClick={() => void handleSaveAction(action.id)}>Guardar</button>
                                  <button type="button" className="flex-1 rounded-xl border border-emerald-500/20 py-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/[0.06] transition" onClick={() => void handleApproveSingleAction(action.id)}>Aprobar</button>
                                  {action.approval_state !== 'rejected' && (
                                    <button type="button" className="rounded-xl border border-red-500/20 py-1.5 px-3 text-[11px] text-red-600 dark:text-red-400 hover:bg-red-500/[0.06] transition" onClick={() => void handleRejectAction(action.id)}>Rechazar</button>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Decisions + Agreements */}
                  {currentAnalysis && (currentAnalysis.decisions.length > 0 || currentAnalysis.agreements.length > 0) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {currentAnalysis.decisions.length > 0 && (
                        <div className="rounded-2xl bg-white dark:bg-[#1a1c20]/50 border border-gray-200 dark:border-white/10 p-5 shadow-sm dark:shadow-lg">
                          <SectionTitle count={currentAnalysis.decisions.length}>Decisiones</SectionTitle>
                          <div className="space-y-2">
                            {currentAnalysis.decisions.map((d, i) => (
                              <div key={i} className="rounded-xl bg-violet-500/[0.03] border border-violet-500/10 p-3">
                                <div className="text-[13px] text-gray-700 dark:text-gray-200 leading-snug">{d.description}</div>
                                <div className="mt-1.5"><ConfidenceBar value={d.confidence} /></div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {currentAnalysis.agreements.length > 0 && (
                        <div className="rounded-2xl bg-white dark:bg-[#1a1c20]/50 border border-gray-200 dark:border-white/10 p-5 shadow-sm dark:shadow-lg">
                          <SectionTitle count={currentAnalysis.agreements.length}>Acuerdos</SectionTitle>
                          <div className="space-y-2">
                            {currentAnalysis.agreements.map((a, i) => (
                              <div key={i} className="rounded-xl bg-teal-500/[0.03] border border-teal-500/10 p-3">
                                <div className="text-[13px] text-gray-700 dark:text-gray-200 leading-snug">{a.description}</div>
                                <div className="mt-1.5"><ConfidenceBar value={a.confidence} /></div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Unresolved items */}
                  {currentAnalysis && currentAnalysis.unresolvedItems.length > 0 && (
                    <div className="rounded-2xl bg-white dark:bg-[#1a1c20]/50 border border-gray-200 dark:border-white/10 p-5 shadow-sm dark:shadow-lg">
                      <SectionTitle count={currentAnalysis.unresolvedItems.length}>Temas pendientes</SectionTitle>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {currentAnalysis.unresolvedItems.map((item, i) => (
                          <div key={i} className="rounded-xl bg-orange-500/[0.03] border border-orange-500/10 p-3">
                            <div className="text-[13px] text-gray-700 dark:text-gray-200 leading-snug">{item.item}</div>
                            <div className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">{item.reasonOpen}</div>
                            <div className="mt-1.5"><ConfidenceBar value={item.confidence} /></div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
