import type {
  PassiveWorkflowSource,
  WorkflowId,
} from './core';
import type { ScheduledTaskExecutionMode } from '../../task-scheduler';

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
  requestedBy?: string | null;
  phoneNumber?: string | null;
  source?: PassiveWorkflowSource;
  executionMode?: ScheduledTaskExecutionMode;
}
