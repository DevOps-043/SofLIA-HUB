import type { ScheduledTaskExecutionMode } from '../task-scheduler';

import type { PassiveWorkflowSource, PassiveWorkflowStatus, WorkflowId } from './core-types';

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
