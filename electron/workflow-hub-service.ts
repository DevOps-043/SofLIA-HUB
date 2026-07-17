import { WORKFLOW_DEFINITIONS } from './workflow-hub/definitions';
import { loadWorkflowHubState, restoreWorkflowHubStateFromHub, saveWorkflowHubState } from './workflow-hub/state-store';
import type {
  ExecuteWorkflowInput,
  PassiveWorkflowRule,
  SavePassiveWorkflowRuleInput,
  SaveWorkflowVariantInput,
  WorkflowApprovalScope,
  WorkflowCaseDetail,
  WorkflowDefinition,
  WorkflowHubOverview,
  WorkflowHubState,
  WorkflowId,
  WorkflowVariant,
} from './workflow-hub/types';
import type { WorkflowHubDependencies } from './workflow-hub/service-context';
import { approveCase, rejectCase, syncCase, updateCaseAction } from './workflow-hub/case-decisions';
import { deletePassiveRule, savePassiveRule } from './workflow-hub/passive-rules-service';
import { executeWorkflow } from './workflow-hub/execution';
import { getOverview } from './workflow-hub/overview';
import { saveVariant } from './workflow-hub/variants-service';

export type {
  ExecuteWorkflowInput,
  PassiveWorkflowRule,
  SavePassiveWorkflowRuleInput,
  SaveWorkflowVariantInput,
  WorkflowCaseAction,
  WorkflowCaseDetail,
  WorkflowCaseSummary,
  WorkflowDefinition,
  WorkflowHubOverview,
  WorkflowVariant,
  WorkspaceCapabilityStatus,
} from './workflow-hub/types';

export class WorkflowHubService {
  state: WorkflowHubState = { variants: [] };

  constructor(public readonly deps: WorkflowHubDependencies) {}

  async init(): Promise<void> {
    // Local primero (sincrono: el servicio queda operativo de inmediato);
    // luego se adopta el estado de la base del Hub SOLO si existe alli
    // (sobrevive formateos). Sin red, el local manda.
    this.loadState();
    const restore = await restoreWorkflowHubStateFromHub();
    if (restore === 'restaurado') this.loadState();
  }

  getOverview(organizationId?: string): Promise<WorkflowHubOverview> {
    return getOverview(this, organizationId);
  }

  async getCaseDetail(caseId: string): Promise<WorkflowCaseDetail> {
    const { getCaseDetail } = await import('./workflow-hub/case-detail');
    return getCaseDetail(this, caseId);
  }

  saveVariant(input: SaveWorkflowVariantInput): WorkflowVariant {
    return saveVariant(this, input);
  }

  savePassiveRule(input: SavePassiveWorkflowRuleInput): PassiveWorkflowRule {
    return savePassiveRule(this, input);
  }

  deletePassiveRule(ruleId: string): boolean {
    return deletePassiveRule(this, ruleId);
  }

  executeWorkflow(input: ExecuteWorkflowInput): Promise<WorkflowCaseDetail> {
    return executeWorkflow(this, input);
  }

  approveCase(input: { caseId: string; decidedBy: string; scope: WorkflowApprovalScope; actionId?: string; comment?: string | null }): Promise<WorkflowCaseDetail> {
    return approveCase(this, input);
  }

  rejectCase(input: { caseId: string; decidedBy: string; scope: 'case' | 'action'; actionId?: string; comment?: string | null }): Promise<WorkflowCaseDetail> {
    return rejectCase(this, input);
  }

  updateCaseAction(input: { caseId: string; actionId: string; updates: import('./meetings/meeting-types').UpdateMeetingActionInput }): Promise<WorkflowCaseDetail> {
    return updateCaseAction(this, input);
  }

  syncCase(input: { caseId: string; decidedBy: string }): Promise<WorkflowCaseDetail> {
    return syncCase(this, input);
  }

  getWorkflowDefinition(workflowId: WorkflowId): WorkflowDefinition {
    const workflow = WORKFLOW_DEFINITIONS.find((candidate) => candidate.id === workflowId);
    if (!workflow) throw new Error('No encontre el workflow solicitado.');
    return workflow;
  }

  loadState(): void {
    try {
      this.state = loadWorkflowHubState();
    } catch (error) {
      console.error('[WorkflowHubService] No se pudo cargar el estado:', error);
      this.state = { variants: [] };
      this.saveState();
    }
  }

  saveState(): void {
    saveWorkflowHubState(this.state);
  }
}
