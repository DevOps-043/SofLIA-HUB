import type { WorkflowHubOverview } from '../../../services/workflow-hub-service';
import { Badge } from './components';

type CapabilityGridProps = {
  capabilities: WorkflowHubOverview['capabilities'];
};

export function CapabilityGrid({ capabilities }: CapabilityGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
      {capabilities.map((capability) => (
        <div key={capability.key} className="rounded-2xl border border-border bg-surface p-4 shadow-sm dark:shadow-none">
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="text-[12px] font-semibold text-gray-900 dark:text-white">{capability.label}</p>
            <Badge value={capability.state} />
          </div>
          <p className="text-[11px] text-secondary leading-relaxed">{capability.message}</p>
          {capability.guidance && <p className="mt-2 text-[11px] text-accent leading-relaxed">{capability.guidance}</p>}
        </div>
      ))}
    </div>
  );
}
