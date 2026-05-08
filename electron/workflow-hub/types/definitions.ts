import type { ScheduledTaskExecutionMode } from '../../task-scheduler';
import type {
  PassiveWorkflowBehavior,
  PassiveWorkflowSource,
  PassiveWorkflowStatus,
  WorkflowCapabilityKey,
  WorkflowCapabilityState,
  WorkflowEngine,
  WorkflowId,
  WorkflowTriggerMode,
} from './core';

export interface WorkspaceCapabilityStatus {
  key: WorkflowCapabilityKey;
  label: string;
  state: WorkflowCapabilityState;
  message: string;
  guidance?: string | null;
}

export interface WorkflowVariant {
  id: string;
  workflowId: WorkflowId;
  name: string;
  description: string;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
}

export interface WorkflowDefinition {
  id: WorkflowId;
  name: string;
  description: string;
  summary: string;
  engine: WorkflowEngine | 'hybrid';
  triggerModes: WorkflowTriggerMode[];
  passiveBehavior?: PassiveWorkflowBehavior;
  configurableFields: string[];
  requiredCapabilities: WorkflowCapabilityKey[];
  optionalCapabilities: WorkflowCapabilityKey[];
  defaultConfig: Record<string, unknown>;
  modes?: string[];
}

export interface PassiveWorkflowRule {
  id: string;
  workflowId?: WorkflowId | null;
  workflowName: string;
  name: string;
  description: string;
  prompt: string;
  scheduleLabel: string;
  cronExpression?: string | null;
  source: PassiveWorkflowSource;
  status: PassiveWorkflowStatus;
  executionMode: ScheduledTaskExecutionMode;
  createdAt: string;
  updatedAt: string;
  lastRunAt?: string | null;
  requestedBy?: string | null;
  phoneNumber?: string | null;
  config?: Record<string, unknown>;
  reason?: string | null;
}

export interface WorkflowHubState {
  variants: WorkflowVariant[];
}
