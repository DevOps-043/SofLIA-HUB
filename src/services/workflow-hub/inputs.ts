import type {
  PassiveWorkflowExecutionMode,
  PassiveWorkflowSource,
  WorkflowId,
} from './core';

export interface ExecuteWorkflowInput {
  workflowId?: WorkflowId;
  variantId?: string;
  requestedBy?: string | null;
  input?: Record<string, unknown>;
}

export interface SaveWorkflowVariantInput {
  variantId?: string | null;
  workflowId: WorkflowId;
  name: string;
  description?: string | null;
  config?: Record<string, unknown>;
  createdBy?: string | null;
}

export interface SavePassiveWorkflowRuleInput {
  ruleId?: string | null;
  workflowId?: WorkflowId | null;
  name: string;
  description?: string | null;
  prompt?: string | null;
  config?: Record<string, unknown>;
  cronExpression?: string | null;
  scheduleLabel?: string | null;
  runOnce?: boolean;
  scheduledFor?: string | null;
  requestedBy?: string | null;
  phoneNumber?: string | null;
  source?: PassiveWorkflowSource;
  executionMode?: PassiveWorkflowExecutionMode;
}

export interface UpdateWorkflowCaseActionInput {
  caseId: string;
  actionId: string;
  updates: {
    title?: string | null;
    description?: string | null;
    team_id?: string | null;
    project_id?: string | null;
    due_date?: string | null;
    owner_candidate?: string | null;
    assignee_id?: string | null;
    summary?: string | null;
  };
}
