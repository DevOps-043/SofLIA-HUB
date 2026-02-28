import { useState, useEffect, useCallback } from 'react';

/* ── Types ── */
interface StepArtifact {
  artifact_id: string;
  artifact_type: string;
  status: string;
  approval_decisions: Array<{
    decision: string;
    reviewer_id: string;
    decided_at: string;
  }>;
}

interface StepRun {
  step_run_id: string;
  step_key: string;
  step_name: string;
  status: string;
  started_at: string | null;
  finished_at: string | null;
  sla_due_at: string | null;
  artifacts: StepArtifact[];
}

interface WorkflowRun {
  run_id: string;
  definition_slug: string;
  workflow_name: string;
  status: string;
  trigger_type: string;
  started_at: string;
  finished_at: string | null;
  steps: StepRun[];
}

interface WorkflowTimelineProps {
  runId: string;
}

/* ── Status config ── */
const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  pending: { bg: 'bg-gray-100 dark:bg-gray-700/40', text: 'text-gray-600 dark:text-gray-400', label: 'Pendiente' },
  in_progress: { bg: 'bg-blue-100 dark:bg-blue-500/20', text: 'text-blue-700 dark:text-blue-400', label: 'En progreso' },
  awaiting_approval: { bg: 'bg-yellow-100 dark:bg-yellow-500/20', text: 'text-yellow-700 dark:text-yellow-400', label: 'Esperando aprobación' },
  approved: { bg: 'bg-green-100 dark:bg-green-500/20', text: 'text-green-700 dark:text-green-400', label: 'Aprobado' },
  rejected: { bg: 'bg-red-100 dark:bg-red-500/20', text: 'text-red-700 dark:text-red-400', label: 'Rechazado' },
  done: { bg: 'bg-green-100 dark:bg-green-500/20', text: 'text-green-700 dark:text-green-400', label: 'Completado' },
  executed: { bg: 'bg-green-100 dark:bg-green-500/20', text: 'text-green-700 dark:text-green-400', label: 'Ejecutado' },
  error: { bg: 'bg-red-100 dark:bg-red-500/20', text: 'text-red-700 dark:text-red-400', label: 'Error' },
  skipped: { bg: 'bg-gray-100 dark:bg-gray-700/40', text: 'text-gray-500 dark:text-gray-500', label: 'Omitido' },
};

const TIMELINE_DOT_COLORS: Record<string, string> = {
  pending: 'bg-gray-400',
  in_progress: 'bg-blue-500',
  awaiting_approval: 'bg-yellow-500',
  approved: 'bg-green-500',
  rejected: 'bg-red-500',
  done: 'bg-green-500',
  executed: 'bg-green-500',
  error: 'bg-red-500',
  skipped: 'bg-gray-400',
};

const ARTIFACT_ICONS: Record<string, string> = {
  email_draft: '\u2709\uFE0F',
  whatsapp_message: '\uD83D\uDCAC',
  iris_task: '\uD83D\uDCCB',
  meeting_agenda: '\uD83D\uDCC5',
  proposal_brief: '\uD83D\uDCC4',
  entity_extraction: '\uD83D\uDCCA',
};

/* ── Helpers ── */
function formatTimestamp(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-ES', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function slaIndicator(sla_due_at: string | null, status: string): { color: string; label: string } | null {
  if (!sla_due_at) return null;
  if (['done', 'executed', 'approved', 'skipped'].includes(status)) {
    return { color: 'text-green-500', label: 'SLA cumplido' };
  }
  const now = Date.now();
  const due = new Date(sla_due_at).getTime();
  const diff = due - now;
  if (diff <= 0) return { color: 'text-red-500', label: 'SLA vencido' };
  if (diff < 15 * 60 * 1000) return { color: 'text-yellow-500', label: 'SLA cercano' };
  return { color: 'text-green-500', label: 'SLA a tiempo' };
}

/* ── Component ── */
export function WorkflowTimeline({ runId }: WorkflowTimelineProps) {
  const [run, setRun] = useState<WorkflowRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRun = useCallback(async () => {
    try {
      setError(null);
      const data = await (window as any).workflow.getRun(runId);
      setRun(data);
    } catch (err: any) {
      console.error('[WorkflowTimeline] Error fetching run:', err);
      setError(err?.message ?? 'Error al cargar el workflow');
    } finally {
      setLoading(false);
    }
  }, [runId]);

  useEffect(() => {
    fetchRun();
  }, [fetchRun]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !run) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-gray-400 dark:text-gray-500">
        <p className="text-sm">{error ?? 'No se encontró el workflow'}</p>
        <button
          onClick={fetchRun}
          className="mt-3 text-sm text-blue-500 hover:text-blue-400 underline"
        >
          Reintentar
        </button>
      </div>
    );
  }

  const runStatus = STATUS_STYLES[run.status] ?? STATUS_STYLES.pending;

  return (
    <div className="bg-white dark:bg-[#111111] text-gray-900 dark:text-gray-100 rounded-2xl border border-gray-200 dark:border-white/10 overflow-hidden">
      {/* Run header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-white/10">
        <div>
          <h3 className="text-base font-semibold">{run.workflow_name}</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {run.definition_slug} &middot; Iniciado: {formatTimestamp(run.started_at)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${runStatus.bg} ${runStatus.text}`}>
            {runStatus.label}
          </span>
          <button
            onClick={fetchRun}
            className="p-2 rounded-lg bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
            title="Actualizar"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Steps timeline */}
      <div className="px-5 py-4">
        <div className="relative">
          {run.steps.map((step, index) => {
            const isLast = index === run.steps.length - 1;
            const dotColor = TIMELINE_DOT_COLORS[step.status] ?? 'bg-gray-400';
            const stepStatus = STATUS_STYLES[step.status] ?? STATUS_STYLES.pending;
            const sla = slaIndicator(step.sla_due_at, step.status);

            return (
              <div key={step.step_run_id} className="relative flex gap-4 pb-6">
                {/* Timeline line + dot */}
                <div className="flex flex-col items-center">
                  <div className={`w-3 h-3 rounded-full ${dotColor} flex-shrink-0 mt-1 ring-2 ring-white dark:ring-[#111111]`} />
                  {!isLast && (
                    <div className="w-0.5 flex-1 bg-gray-200 dark:bg-white/10 mt-1" />
                  )}
                </div>

                {/* Step content */}
                <div className="flex-1 min-w-0 -mt-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{step.step_name}</span>
                    <span className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${stepStatus.bg} ${stepStatus.text}`}>
                      {stepStatus.label}
                    </span>
                    {sla && (
                      <span className={`text-[10px] font-medium ${sla.color}`}>
                        {sla.label}
                      </span>
                    )}
                  </div>

                  {/* Timestamps */}
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 space-x-3">
                    {step.started_at && <span>Inicio: {formatTimestamp(step.started_at)}</span>}
                    {step.finished_at && <span>Fin: {formatTimestamp(step.finished_at)}</span>}
                  </div>

                  {/* Artifacts */}
                  {step.artifacts && step.artifacts.length > 0 && (
                    <div className="mt-2 space-y-1.5">
                      {step.artifacts.map((artifact) => {
                        const artIcon = ARTIFACT_ICONS[artifact.artifact_type] ?? '\uD83D\uDCC4';
                        const artStatus = STATUS_STYLES[artifact.status] ?? STATUS_STYLES.pending;

                        return (
                          <div
                            key={artifact.artifact_id}
                            className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-white/5"
                          >
                            <span className="text-base">{artIcon}</span>
                            <span className="text-xs text-gray-600 dark:text-gray-300 flex-1">
                              {artifact.artifact_type.replace(/_/g, ' ')}
                            </span>
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${artStatus.bg} ${artStatus.text}`}>
                              {artStatus.label}
                            </span>
                            {/* Approval decisions */}
                            {artifact.approval_decisions?.map((dec, di) => (
                              <span
                                key={di}
                                className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                                  dec.decision === 'approved'
                                    ? 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400'
                                    : dec.decision === 'rejected'
                                    ? 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400'
                                    : 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400'
                                }`}
                              >
                                {dec.decision}
                              </span>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
