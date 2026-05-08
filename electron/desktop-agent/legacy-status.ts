import type { AgentStatus, AgentTask } from '../desktop-agent-types';

type BackendRuntimeStatus = {
  status: string;
  currentTask?: string | null;
  currentStep: number;
};

export type LegacyDesktopStatus = {
  status: AgentStatus;
  currentTask: string | null;
  currentStep: number;
};

export function resolveLegacyDesktopStatus(input: {
  browserStatus: BackendRuntimeStatus;
  windowsUIAStatus: BackendRuntimeStatus;
  activeTasks: Iterable<AgentTask>;
  observationRunning: boolean;
}): LegacyDesktopStatus {
  if (input.browserStatus.status !== 'idle') {
    return {
      status: 'executing',
      currentTask: input.browserStatus.currentTask || null,
      currentStep: input.browserStatus.currentStep,
    };
  }
  if (input.windowsUIAStatus.status !== 'idle') {
    return {
      status: 'executing',
      currentTask: input.windowsUIAStatus.currentTask || null,
      currentStep: input.windowsUIAStatus.currentStep,
    };
  }

  const currentDesktopTask = input.activeTasks[Symbol.iterator]().next().value as AgentTask | undefined;
  if (currentDesktopTask) {
    return {
      status: currentDesktopTask.status,
      currentTask: currentDesktopTask.task,
      currentStep: currentDesktopTask.currentStep,
    };
  }
  if (input.observationRunning) {
    return { status: 'observing', currentTask: null, currentStep: 0 };
  }
  return { status: 'idle', currentTask: null, currentStep: 0 };
}
