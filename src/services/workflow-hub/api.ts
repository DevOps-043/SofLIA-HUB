import type {
  WorkflowApprovalScope,
} from './core';
import type {
  ExecuteWorkflowInput,
  SavePassiveWorkflowRuleInput,
  SaveWorkflowVariantInput,
  UpdateWorkflowCaseActionInput,
} from './inputs';
import type { PassiveWorkflowRule, WorkflowVariant } from './definitions';
import type { WorkflowCaseDetail } from './cases';
import type { WorkflowHubOverview } from './overview';

declare global {
  interface Window {
    workflowHub?: {
      getOverview: (organizationId?: string) => Promise<{ success: boolean; overview?: WorkflowHubOverview; error?: string }>;
      getCaseDetail: (caseId: string) => Promise<{ success: boolean; detail?: WorkflowCaseDetail; error?: string }>;
      executeWorkflow: (input: ExecuteWorkflowInput) => Promise<{ success: boolean; detail?: WorkflowCaseDetail; error?: string }>;
      saveVariant: (input: SaveWorkflowVariantInput) => Promise<{ success: boolean; variant?: WorkflowVariant; error?: string }>;
      savePassiveRule: (input: SavePassiveWorkflowRuleInput) => Promise<{ success: boolean; rule?: PassiveWorkflowRule; error?: string }>;
      deletePassiveRule: (ruleId: string) => Promise<{ success: boolean; deleted?: boolean; error?: string }>;
      approveCase: (input: {
        caseId: string;
        decidedBy: string;
        scope: WorkflowApprovalScope;
        actionId?: string;
        comment?: string | null;
      }) => Promise<{ success: boolean; detail?: WorkflowCaseDetail; error?: string }>;
      rejectCase: (input: {
        caseId: string;
        decidedBy: string;
        scope: 'case' | 'action';
        actionId?: string;
        comment?: string | null;
      }) => Promise<{ success: boolean; detail?: WorkflowCaseDetail; error?: string }>;
      updateCaseAction: (input: UpdateWorkflowCaseActionInput) => Promise<{ success: boolean; detail?: WorkflowCaseDetail; error?: string }>;
      syncCase: (input: { caseId: string; decidedBy: string }) => Promise<{ success: boolean; detail?: WorkflowCaseDetail; error?: string }>;
    };
  }
}

function getAPI() {
  if (!window.workflowHub) {
    throw new Error('Workflow Hub no disponible. Ejecuta Pulse dentro de Electron.');
  }
  return window.workflowHub;
}

export function isWorkflowHubAvailable(): boolean {
  return !!window.workflowHub;
}

export async function getWorkflowHubOverview(organizationId?: string) {
  return getAPI().getOverview(organizationId);
}

export async function getWorkflowCaseDetail(caseId: string) {
  return getAPI().getCaseDetail(caseId);
}

export async function executeWorkflowHub(input: ExecuteWorkflowInput) {
  return getAPI().executeWorkflow(input);
}

export async function saveWorkflowVariant(input: SaveWorkflowVariantInput) {
  return getAPI().saveVariant(input);
}

export async function savePassiveWorkflowRule(input: SavePassiveWorkflowRuleInput) {
  return getAPI().savePassiveRule(input);
}

export async function deletePassiveWorkflowRule(ruleId: string) {
  return getAPI().deletePassiveRule(ruleId);
}

export async function approveWorkflowCase(input: {
  caseId: string;
  decidedBy: string;
  scope: WorkflowApprovalScope;
  actionId?: string;
  comment?: string | null;
}) {
  return getAPI().approveCase(input);
}

export async function rejectWorkflowCase(input: {
  caseId: string;
  decidedBy: string;
  scope: 'case' | 'action';
  actionId?: string;
  comment?: string | null;
}) {
  return getAPI().rejectCase(input);
}

export async function updateWorkflowCaseAction(input: UpdateWorkflowCaseActionInput) {
  return getAPI().updateCaseAction(input);
}

export async function syncWorkflowCase(input: { caseId: string; decidedBy: string }) {
  return getAPI().syncCase(input);
}
