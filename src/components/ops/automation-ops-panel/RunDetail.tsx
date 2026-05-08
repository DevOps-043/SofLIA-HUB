import { ApprovalPanel } from './ApprovalPanel';
import { formatDateTime } from './formatters';
import { PreviewGrid } from './PreviewGrid';
import { ProposedActions } from './ProposedActions';
import { RUN_STATUS_STYLES } from './styles';
import { StatusBadge } from './StatusBadge';
import type { AutomationOpsController } from './useAutomationOpsController';

export function RunDetail({ controller }: { controller: AutomationOpsController }) {
  const selectedRun = controller.data.selectedRun;
  if (!selectedRun) return null;

  return (
    <>
      <div className="bg-white dark:bg-[#1a1c20]/50 backdrop-blur-sm border border-gray-200 dark:border-white/10 rounded-2xl p-5 shadow-sm dark:shadow-lg">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0 flex-1">
            <p className="text-base font-bold text-gray-900 dark:text-white tracking-tight">{selectedRun.title}</p>
            {selectedRun.summary && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{selectedRun.summary}</p>}
          </div>
          <StatusBadge value={selectedRun.status} styles={RUN_STATUS_STYLES} />
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-gray-400 dark:text-gray-500 mb-4">
          <span>Folio: <span className="font-mono">{selectedRun.id.slice(0, 12)}</span></span>
          <span>{formatDateTime(selectedRun.createdAt)}</span>
          {selectedRun.requestedBy && <span>Por: {selectedRun.requestedBy}</span>}
        </div>
        <PreviewGrid values={selectedRun.preview || {}} />
        <ApprovalPanel controller={controller} />
      </div>
      <ProposedActions controller={controller} />
    </>
  );
}
