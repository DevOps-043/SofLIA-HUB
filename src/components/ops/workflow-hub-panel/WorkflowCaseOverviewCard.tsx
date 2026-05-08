import { Badge } from './components';
import { formatDateTime, prettyValue, previewValue } from './formatters';

export function WorkflowCaseOverviewCard({ detail }: { detail: any }) {
  return (
    <div className="bg-white dark:bg-[#1a1c20]/50 backdrop-blur-sm border border-gray-200 dark:border-white/10 rounded-2xl p-5 shadow-sm dark:shadow-lg">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <p className="text-base font-bold text-gray-900 dark:text-white tracking-tight">{detail.title}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{detail.summary || 'Sin resumen.'}</p>
        </div>
        <Badge value={detail.normalizedStatus} />
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-gray-400 dark:text-gray-500">
        <span>Caso: <span className="font-mono">{detail.id}</span></span>
        <span>Workflow: {detail.workflowName}</span>
        <span>{formatDateTime(detail.updatedAt)}</span>
      </div>
      {detail.reasons.length > 0 && (
        <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/8 p-4 space-y-1">
          {detail.reasons.map((reason: string, index: number) => (
            <div key={`${reason}-${index}`} className="text-xs text-amber-700 dark:text-amber-200">{reason}</div>
          ))}
        </div>
      )}
      {Object.keys(detail.preview || {}).length > 0 && (
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {Object.entries(detail.preview || {}).map(([key, value]) => (
            <div key={key} className="rounded-lg border border-gray-100 dark:border-white/[0.05] bg-gray-50 dark:bg-black/10 px-3 py-2">
              <p className="text-[9px] uppercase tracking-wider text-gray-500 dark:text-gray-500 truncate">{prettyValue(key)}</p>
              <p className="mt-1 text-[12px] text-gray-800 dark:text-gray-200 line-clamp-3 break-words">{previewValue(value)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
