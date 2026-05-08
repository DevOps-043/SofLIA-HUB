import { CapabilityGrid } from './CapabilityGrid';
import { LegacyTemplatesNotice } from './LegacyTemplatesNotice';
import { WorkflowHubAlerts } from './WorkflowHubAlerts';
import { WorkflowHubHeader } from './WorkflowHubHeader';
import { WorkflowSelectionColumn } from './WorkflowSelectionColumn';
import { WorkflowEditorPanel } from './WorkflowEditorPanel';
import { WorkflowCasesSection } from './WorkflowCasesSection';
import type { WorkflowHubController } from './useWorkflowHubController';
import { deletePassiveWorkflowRule } from '../../../services/workflow-hub-service';

export function WorkflowHubPanelView({ controller }: { controller: WorkflowHubController }) {
  return (
    <div className="h-full flex flex-col overflow-hidden">
      <WorkflowHubHeader loading={controller.loading} onRefresh={() => void controller.refreshOverview(true)} />
      <WorkflowHubAlerts error={controller.error} notice={controller.notice} />
      <div className="flex-1 overflow-y-auto no-scrollbar">
        <section className="px-6 pt-2 pb-5 space-y-5">
          <CapabilityGrid capabilities={controller.overview?.capabilities || []} />
          <LegacyTemplatesNotice overview={controller.overview} />
          <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-5">
            <WorkflowSelectionColumn
              passiveCapableWorkflows={controller.passiveCapableWorkflows}
              activationCapableWorkflows={controller.activationCapableWorkflows}
              passiveRules={controller.passiveRules}
              workflowVariants={controller.workflowVariants}
              selectedWorkflowId={controller.selectedWorkflowId}
              selectedVariantId={controller.selectedVariantId}
              hasSelectedVariant={Boolean(controller.selectedVariant)}
              actionKey={controller.actionKey}
              onSelectWorkflow={(workflowId) => { controller.setSelectedWorkflowId(workflowId); controller.setSelectedVariantId(null); }}
              onSelectVariant={controller.setSelectedVariantId}
              onDeletePassiveRule={(rule) => void controller.runAction(`delete-passive-${rule.id}`, async () => {
                const result = await deletePassiveWorkflowRule(rule.id);
                if (!result.success || !result.deleted) throw new Error(result.error || 'No pude eliminar el workflow pasivo.');
                await controller.refreshOverview(true, controller.selectedCaseId || undefined);
                controller.setNotice(`Workflow pasivo eliminado: ${rule.name}.`);
              })}
            />
            <WorkflowEditorPanel controller={controller} />
          </div>
        </section>
        <WorkflowCasesSection controller={controller} />
      </div>
    </div>
  );
}
