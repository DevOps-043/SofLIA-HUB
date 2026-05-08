import { prettyActionKind } from './formatters';
import { PreviewGrid } from './PreviewGrid';
import { ACTION_STATUS_STYLES } from './styles';
import { StatusBadge } from './StatusBadge';
import type { AutomationOpsController } from './useAutomationOpsController';

export function ProposedActions({ controller }: { controller: AutomationOpsController }) {
  const selectedRun = controller.data.selectedRun;
  if (!selectedRun || selectedRun.actions.length === 0) return null;

  return (
    <div className="bg-white dark:bg-[#1a1c20]/50 backdrop-blur-sm border border-gray-200 dark:border-white/10 rounded-2xl p-5 shadow-sm dark:shadow-lg">
      <p className="text-sm font-bold text-gray-900 dark:text-white mb-3">Acciones propuestas</p>
      <div className="space-y-3">
        {selectedRun.actions.map((action) => (
          <div key={action.id} className="rounded-xl border border-gray-100 dark:border-white/[0.06] bg-gray-50 dark:bg-white/[0.02] p-3">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-gray-900 dark:text-white">{action.title}</p>
                <p className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500 mt-0.5">{prettyActionKind(action.kind)}</p>
              </div>
              <StatusBadge value={action.status} styles={ACTION_STATUS_STYLES} />
            </div>
            <PreviewGrid values={action.payload || {}} />
          </div>
        ))}
      </div>
    </div>
  );
}
