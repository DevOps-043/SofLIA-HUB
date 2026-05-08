import type { PanelState } from './workflow-controller-state';

export function buildSelectionPatch(state: PanelState): Partial<PanelState> | null {
  if (!state.overview) return null;
  const workflow = state.overview.workflows.find((item) => item.id === state.selectedWorkflowId) || state.overview.workflows[0] || null;
  if (!workflow) return null;
  if (workflow.id !== state.selectedWorkflowId) return { selectedWorkflowId: workflow.id };
  if (state.selectedVariantId && !state.overview.variants.some((variant) => variant.id === state.selectedVariantId && variant.workflowId === workflow.id)) {
    return { selectedVariantId: null };
  }
  const variant = state.overview.variants.find((item) => item.id === state.selectedVariantId) || null;
  return {
    draftConfig: { ...(workflow.defaultConfig || {}), ...(variant?.config || {}) },
    variantName: variant?.name || '',
    variantDescription: variant?.description || '',
    passiveRuleName: state.passiveRuleName || `${workflow.name} programado`,
    passiveRuleDescription: state.passiveRuleDescription || `Workflow pasivo de ${workflow.name.toLowerCase()}.`,
    selectedCaseId: state.selectedCaseId || state.overview.cases[0]?.id || null,
  };
}
