import { ActionBuilder } from './automation-ops-panel/ActionBuilder';
import { CasesSection } from './automation-ops-panel/CasesSection';
import { ExtrasPanel } from './automation-ops-panel/ExtrasPanel';
import { PanelAlerts } from './automation-ops-panel/PanelAlerts';
import { PanelHeader } from './automation-ops-panel/PanelHeader';
import { UnavailablePanel } from './automation-ops-panel/UnavailablePanel';
import type { AutomationOpsPanelProps } from './automation-ops-panel/types';
import { useAutomationOpsController } from './automation-ops-panel/useAutomationOpsController';

export const AutomationOpsPanel = ({ userId }: AutomationOpsPanelProps) => {
  const controller = useAutomationOpsController(userId);
  const bridge = controller.bridge;

  if (!bridge.automation && !bridge.telegram && !bridge.remoteNode) {
    return <UnavailablePanel />;
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <PanelHeader controller={controller} />
      <PanelAlerts error={controller.runner.error} notice={controller.runner.notice} />
      <div className="flex-1 overflow-y-auto no-scrollbar">
        <section className="px-6 pt-2 pb-5">
          <ActionBuilder controller={controller} />
          <ExtrasPanel controller={controller} />
        </section>
        <CasesSection controller={controller} />
      </div>
    </div>
  );
};
