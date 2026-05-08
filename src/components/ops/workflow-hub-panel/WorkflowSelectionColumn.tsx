import type { WorkflowHubOverview, WorkflowId } from '../../../services/workflow-hub-service';
import { PassiveRulesList } from './PassiveRulesList';
import { WorkflowCardSection } from './WorkflowCardSection';
import { WorkflowVariantsPicker } from './WorkflowVariantsPicker';

type WorkflowSelectionColumnProps = {
  passiveCapableWorkflows: WorkflowHubOverview['workflows'];
  activationCapableWorkflows: WorkflowHubOverview['workflows'];
  passiveRules: WorkflowHubOverview['passiveRules'];
  workflowVariants: WorkflowHubOverview['variants'];
  selectedWorkflowId: WorkflowId;
  selectedVariantId: string | null;
  hasSelectedVariant: boolean;
  actionKey: string | null;
  onSelectWorkflow: (workflowId: WorkflowId) => void;
  onSelectVariant: (variantId: string | null) => void;
  onDeletePassiveRule: (rule: WorkflowHubOverview['passiveRules'][number]) => void;
};

export function WorkflowSelectionColumn({
  passiveCapableWorkflows,
  activationCapableWorkflows,
  passiveRules,
  workflowVariants,
  selectedWorkflowId,
  selectedVariantId,
  hasSelectedVariant,
  actionKey,
  onSelectWorkflow,
  onSelectVariant,
  onDeletePassiveRule,
}: WorkflowSelectionColumnProps) {
  return (
    <div className="space-y-4">
      <WorkflowCardSection
        title="Pasivos"
        eyebrow="Se ejecutan solos"
        workflows={passiveCapableWorkflows}
        selectedWorkflowId={selectedWorkflowId}
        passive
        onSelect={onSelectWorkflow}
      />

      <PassiveRulesList passiveRules={passiveRules} actionKey={actionKey} onDeleteRule={onDeletePassiveRule} />

      <WorkflowCardSection
        title="Activacion"
        eyebrow="Se lanzan al pedirlos"
        workflows={activationCapableWorkflows}
        selectedWorkflowId={selectedWorkflowId}
        onSelect={onSelectWorkflow}
      />

      <WorkflowVariantsPicker
        variants={workflowVariants}
        selectedVariantId={selectedVariantId}
        hasSelectedVariant={hasSelectedVariant}
        onSelectVariant={onSelectVariant}
      />
    </div>
  );
}
