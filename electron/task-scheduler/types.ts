export type ScheduledTaskKind =
  | 'legacy_prompt'
  | 'passive_prompt'
  | 'passive_workflow';

export type ScheduledTaskExecutionMode =
  | 'agent_prompt'
  | 'workflow';

export interface ScheduledTaskInfo {
  id: string;
  cronExpression: string;
  prompt: string;
  phoneNumber: string;
  createdAt: string;
  updatedAt?: string;
  lastRun?: string;
  name?: string;
  description?: string;
  scheduleLabel?: string;
  source?: 'legacy' | 'chat' | 'app';
  kind?: ScheduledTaskKind;
  executionMode?: ScheduledTaskExecutionMode;
  workflowId?: string | null;
  workflowInput?: Record<string, unknown>;
  requestedBy?: string | null;
  passiveRuleId?: string | null;
}

export interface ScheduledTaskCreateInput {
  id?: string;
  cronExpression: string;
  prompt: string;
  phoneNumber?: string;
  name?: string;
  description?: string;
  scheduleLabel?: string;
  source?: 'legacy' | 'chat' | 'app';
  kind?: ScheduledTaskKind;
  executionMode?: ScheduledTaskExecutionMode;
  workflowId?: string | null;
  workflowInput?: Record<string, unknown>;
  requestedBy?: string | null;
  passiveRuleId?: string | null;
  createdAt?: string;
  lastRun?: string;
}
