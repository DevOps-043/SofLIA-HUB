import { ACTION_TABS } from './constants';
import type { AutomationOpsController } from './useAutomationOpsController';

export function ActionTabs({ controller }: { controller: AutomationOpsController }) {
  return (
    <div className="overflow-x-auto no-scrollbar mb-4">
      <div className="flex gap-1.5 min-w-max">
        {ACTION_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => controller.forms.action.setActive(tab.id)}
            className={`px-3.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all whitespace-nowrap ${
              controller.forms.action.active === tab.id
                ? 'bg-accent/10 text-accent border border-accent/20'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/[0.04] border border-transparent'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}
