import type { AgentStatus } from '../../src/shared/desktop-agent';
export type { AgentStatus, DesktopAgentStatus } from '../../src/shared/desktop-agent';
import type { ActionHistoryEntry } from './action-types';
import type { TaskPlan } from './planning-types';

export interface RecoveryContext {
  consecutiveFailures: number;
  sameScreenCount: number;
  lastScreenHash: string;
  totalRecoveries: number;
  lastRecoveryStep: number;
}

export interface AgentTask {
  id: string;
  task: string;
  status: AgentStatus;
  currentStep: number;
  maxSteps: number;
  plan: TaskPlan | null;
  actionHistory: ActionHistoryEntry[];
  recovery: RecoveryContext;
  abortController: AbortController;
  startedAt: number;
  completedAt?: number;
  result?: string;
  error?: string;
}
