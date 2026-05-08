import type { WorkflowHubOverview } from '../../../services/workflow-hub-service';
import { Badge } from './components';

type CapabilityGridProps = {
  capabilities: WorkflowHubOverview['capabilities'];
};

export function CapabilityGrid({ capabilities }: CapabilityGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
      {capabilities.map((capability) => (
        <div key={capability.key} className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1a1c20]/50 p-4 shadow-sm dark:shadow-lg">
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="text-[12px] font-semibold text-gray-900 dark:text-white">{capability.label}</p>
            <Badge value={capability.state} />
          </div>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">{capability.message}</p>
          {capability.guidance && <p className="mt-2 text-[11px] text-accent leading-relaxed">{capability.guidance}</p>}
        </div>
      ))}
    </div>
  );
}
