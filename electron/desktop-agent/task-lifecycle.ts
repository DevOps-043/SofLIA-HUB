import type { AgentStatus, AgentTask } from '../desktop-agent-types';

type LegacyTaskState = {
  status: AgentStatus;
  currentTask: string | null;
  abortController: AbortController | null;
};

export function createDesktopAgentTask(input: {
  taskId: string;
  task: string;
  maxSteps: number;
  abortController: AbortController;
}): AgentTask {
  return {
    id: input.taskId,
    task: input.task,
    status: 'executing',
    currentStep: 0,
    maxSteps: input.maxSteps,
    plan: null,
    actionHistory: [],
    recovery: {
      consecutiveFailures: 0,
      sameScreenCount: 0,
      lastScreenHash: '',
      totalRecoveries: 0,
      lastRecoveryStep: -10,
    },
    abortController: input.abortController,
    startedAt: Date.now(),
  };
}

export function finishDesktopAgentTask(input: {
  agentTask: AgentTask;
  activeTasks: Map<string, AgentTask>;
  taskId: string;
}): LegacyTaskState {
  input.agentTask.status = 'idle';
  input.agentTask.completedAt = Date.now();
  input.activeTasks.delete(input.taskId);

  const next = input.activeTasks.values().next().value;
  if (!next) {
    return { status: 'idle', currentTask: null, abortController: null };
  }

  return {
    status: next.status,
    currentTask: next.task,
    abortController: next.abortController,
  };
}
