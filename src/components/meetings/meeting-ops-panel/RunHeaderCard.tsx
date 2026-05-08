import { StatusBadge } from './base-components';
import type { RunDetail } from './run-detail-types';

interface RunHeaderCardProps {
  detail: RunDetail;
  onApproveActions: () => void;
  onApproveAsset: () => void;
  onSyncActions: () => void;
}

export function RunHeaderCard({ detail, onApproveActions, onApproveAsset, onSyncActions }: RunHeaderCardProps) {
  return (
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
        <button type="button" className="rounded-xl px-4 py-2 text-[12px] font-medium border border-gray-200 dark:border-white/[0.06] text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:border-gray-300 dark:hover:border-white/10 transition" onClick={onApproveAsset}>Aprobar resumen</button>
        <button type="button" className="rounded-xl px-4 py-2 text-[12px] font-medium border border-gray-200 dark:border-white/[0.06] text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:border-gray-300 dark:hover:border-white/10 transition" onClick={onApproveActions}>Aprobar acciones</button>
        <button type="button" className="rounded-xl px-4 py-2 text-[12px] font-medium bg-accent text-white hover:bg-accent/90 transition" onClick={onSyncActions}>Sincronizar</button>
      </div>
    </div>
  );
}
