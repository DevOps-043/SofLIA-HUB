import type { RunDetail } from './run-detail-types';

interface SummaryCardsProps {
  detail: RunDetail;
}

export function SummaryCards({ detail }: SummaryCardsProps) {
  return (
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
  );
}
