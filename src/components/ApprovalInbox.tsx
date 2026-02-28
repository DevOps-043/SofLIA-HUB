import { useState, useEffect, useCallback } from 'react';
import { ArtifactReviewModal } from './ArtifactReviewModal';

/* ── Types ── */
export interface PendingApproval {
  artifact_id: string;
  step_run_id: string;
  run_id: string;
  trace_id: string;
  step_key: string;
  step_name: string;
  artifact_type: string;
  ai_output_raw: string | null;
  qa_result: { passed: boolean; issues: string[] } | null;
  sla_due_at: string | null;
  assigned_to: string | null;
  workflow_name: string;
  trigger_type: string;
  context_data: Record<string, any>;
  created_at: string;
}

interface ApprovalInboxProps {
  userId: string;
  organizationId?: string;
}

/* ── Helpers ── */
const ARTIFACT_ICONS: Record<string, string> = {
  email_draft: '\u2709\uFE0F',
  whatsapp_message: '\uD83D\uDCAC',
  iris_task: '\uD83D\uDCCB',
  meeting_agenda: '\uD83D\uDCC5',
  proposal_brief: '\uD83D\uDCC4',
  entity_extraction: '\uD83D\uDCCA',
};

const ARTIFACT_LABELS: Record<string, string> = {
  email_draft: 'Borrador de Email',
  whatsapp_message: 'Mensaje WhatsApp',
  iris_task: 'Tarea Iris',
  meeting_agenda: 'Agenda de Reunión',
  proposal_brief: 'Brief de Propuesta',
  entity_extraction: 'Extracción de Entidades',
};

const FILTER_OPTIONS = [
  { value: 'all', label: 'Todos los tipos' },
  { value: 'email_draft', label: 'Borrador de Email' },
  { value: 'whatsapp_message', label: 'Mensaje WhatsApp' },
  { value: 'iris_task', label: 'Tarea Iris' },
  { value: 'meeting_agenda', label: 'Agenda de Reunión' },
  { value: 'proposal_brief', label: 'Brief de Propuesta' },
];

function timeRemaining(sla_due_at: string | null): { label: string; breached: boolean; urgency: number } {
  if (!sla_due_at) return { label: 'Sin SLA', breached: false, urgency: 0 };
  const now = Date.now();
  const due = new Date(sla_due_at).getTime();
  const diff = due - now;
  if (diff <= 0) {
    const mins = Math.abs(Math.round(diff / 60000));
    return { label: `Vencido hace ${mins}m`, breached: true, urgency: 999 + mins };
  }
  const mins = Math.round(diff / 60000);
  if (mins < 60) return { label: `${mins}m restantes`, breached: false, urgency: 60 - mins };
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return { label: `${hours}h ${remMins}m restantes`, breached: false, urgency: Math.max(0, 60 - mins) };
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/* ── Component ── */
export function ApprovalInbox({ userId, organizationId }: ApprovalInboxProps) {
  const [approvals, setApprovals] = useState<PendingApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all');
  const [sortByUrgency, setSortByUrgency] = useState(true);
  const [selectedApproval, setSelectedApproval] = useState<PendingApproval | null>(null);

  const fetchApprovals = useCallback(async () => {
    try {
      const filters = organizationId ? { organizationId } : undefined;
      const data = await (window as any).workflow.getPendingApprovals(filters);
      setApprovals(data ?? []);
    } catch (err) {
      console.error('[ApprovalInbox] Error fetching approvals:', err);
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    fetchApprovals();

    // Poll every 30s
    const interval = setInterval(fetchApprovals, 30000);

    // Real-time event listener
    const handleNewApproval = (_event: any, approval: PendingApproval) => {
      setApprovals((prev) => {
        const exists = prev.some((a) => a.artifact_id === approval.artifact_id);
        if (exists) return prev;
        return [approval, ...prev];
      });
    };

    try {
      (window as any).workflow?.on?.('workflow:approval-needed', handleNewApproval);
    } catch {
      // Event API may not be available
    }

    return () => {
      clearInterval(interval);
      try {
        (window as any).workflow?.off?.('workflow:approval-needed', handleNewApproval);
      } catch {
        // ignore
      }
    };
  }, [fetchApprovals]);

  const handleDecision = useCallback(
    (_decision: string) => {
      // Remove approved/rejected item from list
      if (selectedApproval) {
        setApprovals((prev) => prev.filter((a) => a.artifact_id !== selectedApproval.artifact_id));
      }
      setSelectedApproval(null);
    },
    [selectedApproval],
  );

  /* ── Filtered & sorted list ── */
  const filtered = approvals
    .filter((a) => filterType === 'all' || a.artifact_type === filterType)
    .sort((a, b) => {
      if (!sortByUrgency) return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      return timeRemaining(b.sla_due_at).urgency - timeRemaining(a.sla_due_at).urgency;
    });

  /* ── Render ── */
  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#111111] text-gray-900 dark:text-gray-100">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-white/10">
        <div>
          <h2 className="text-lg font-semibold">Bandeja de Aprobaciones</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {approvals.length} pendiente{approvals.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={fetchApprovals}
          className="p-2 rounded-lg bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
          title="Actualizar"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-200 dark:border-white/10">
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="text-sm px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
        >
          {FILTER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <button
          onClick={() => setSortByUrgency((v) => !v)}
          className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${
            sortByUrgency
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400'
              : 'bg-gray-100 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400'
          }`}
        >
          {sortByUrgency ? 'Urgencia SLA' : 'Más reciente'}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400 dark:text-gray-500">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mb-3 opacity-40">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <p className="text-sm font-medium">Sin aprobaciones pendientes</p>
            <p className="text-xs mt-1">Todo al día</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-white/5">
            {filtered.map((item) => {
              const sla = timeRemaining(item.sla_due_at);
              const icon = ARTIFACT_ICONS[item.artifact_type] ?? '\uD83D\uDCC4';
              const typeLabel = ARTIFACT_LABELS[item.artifact_type] ?? item.artifact_type;

              return (
                <li
                  key={item.artifact_id}
                  onClick={() => setSelectedApproval(item)}
                  className="flex items-center gap-4 px-5 py-3.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                >
                  {/* Icon */}
                  <span className="text-2xl flex-shrink-0">{icon}</span>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{item.step_name}</span>
                      <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400 font-semibold">
                        {typeLabel}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                      {item.workflow_name} &middot; {formatDate(item.created_at)}
                    </p>
                  </div>

                  {/* SLA badge */}
                  <div className="flex-shrink-0 text-right">
                    <span
                      className={`text-xs font-medium px-2 py-1 rounded-full ${
                        sla.breached
                          ? 'bg-red-500/10 text-red-500 dark:text-red-400'
                          : 'bg-green-500/10 text-green-600 dark:text-green-400'
                      }`}
                    >
                      {sla.label}
                    </span>
                  </div>

                  {/* QA warning */}
                  {item.qa_result && !item.qa_result.passed && (
                    <span className="flex-shrink-0 text-amber-500" title="QA con advertencias">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                        <line x1="12" y1="9" x2="12" y2="13" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                      </svg>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Review modal */}
      {selectedApproval && (
        <ArtifactReviewModal
          approval={selectedApproval}
          onClose={() => setSelectedApproval(null)}
          onDecision={handleDecision}
          userId={userId}
        />
      )}
    </div>
  );
}
