import { formatDateTime, prettyTemplateId } from './formatters';
import { RUN_STATUS_STYLES } from './styles';
import { StatusBadge } from './StatusBadge';
import type { AutomationOpsController } from './useAutomationOpsController';

export function RunCardsGrid({ controller }: { controller: AutomationOpsController }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {controller.data.runs.map((run) => (
        <button
          key={run.id}
          type="button"
          onClick={() => controller.data.setSelectedRunId(controller.data.selectedRunId === run.id ? null : run.id)}
          className={`w-full text-left rounded-xl border px-4 py-3 transition-all ${
            controller.data.selectedRunId === run.id
              ? 'border-accent/30 bg-accent/8 shadow-md ring-1 ring-accent/10'
              : 'border-gray-200 dark:border-white/[0.06] hover:border-accent/20 bg-white dark:bg-white/[0.02]'
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-[12px] font-semibold text-gray-900 dark:text-white line-clamp-2 flex-1">{run.title}</p>
            <StatusBadge value={run.status} styles={RUN_STATUS_STYLES} />
          </div>
          <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1.5 truncate">
            {prettyTemplateId(run.templateId)} - {formatDateTime(run.updatedAt)}
          </p>
        </button>
      ))}
    </div>
  );
}
