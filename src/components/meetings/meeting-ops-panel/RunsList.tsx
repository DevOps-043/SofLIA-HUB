import type { MeetingRunSummary } from '../../../services/meeting-service';
import { StatusBadge } from './base-components';

interface RunsListProps {
  runs: MeetingRunSummary[];
  selectedRunId: string | null;
  onSelectRun: (runId: string | null) => void;
}

export function RunsList({ runs, selectedRunId, onSelectRun }: RunsListProps) {
  const reviewCount = runs.filter((summary) => summary.run.status === 'REVIEW_REQUIRED').length;

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-bold text-gray-900 dark:text-white">Runs recientes</p>
        {reviewCount > 0 && (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/20">
            {reviewCount} por revisar
          </span>
        )}
      </div>
      {runs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 dark:border-white/[0.06] px-4 py-10 text-center text-xs text-gray-500 dark:text-gray-500">
          No hay runs todavia. Crea uno arriba para empezar.
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {runs.map((summary) => (
              <RunCard
                key={summary.run.id}
                isSelected={selectedRunId === summary.run.id}
                onClick={() => onSelectRun(selectedRunId === summary.run.id ? null : summary.run.id)}
                summary={summary}
              />
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function RunCard({ isSelected, onClick, summary }: { isSelected: boolean; onClick: () => void; summary: MeetingRunSummary }) {
  return (
    <button type="button" onClick={onClick} className={`w-full text-left rounded-xl border px-4 py-3 transition-all ${isSelected ? 'border-accent/30 bg-accent/8 shadow-md ring-1 ring-accent/10' : 'border-gray-200 dark:border-white/[0.06] hover:border-accent/20 bg-white dark:bg-white/[0.02]'}`}>
      <p className="text-[12px] font-semibold text-gray-900 dark:text-white leading-tight truncate">{summary.run.meeting_title || 'Sin titulo'}</p>
      <div className="mt-1.5 flex items-center gap-2">
        <StatusBadge status={summary.run.status} />
        <span className="text-[10px] text-gray-400 dark:text-gray-500">{new Date(summary.run.created_at).toLocaleDateString()}</span>
      </div>
      {(summary.counts.approved_actions > 0 || summary.counts.synced_actions > 0) && (
        <div className="mt-1.5 flex gap-3 text-[10px] text-gray-400 dark:text-gray-500">
          {summary.counts.approved_actions > 0 && <span>{summary.counts.approved_actions} aprobadas</span>}
          {summary.counts.synced_actions > 0 && <span>{summary.counts.synced_actions} sincronizadas</span>}
        </div>
      )}
    </button>
  );
}
