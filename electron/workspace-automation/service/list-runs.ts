import type { WorkspaceAutomationService } from '../../workspace-automation-service.ts';
import type { WorkflowRunRecord } from '../types';

export function listRuns(this: WorkspaceAutomationService, limit = 20): WorkflowRunRecord[] {
    return this.state.runs
      .slice()
      .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
      .slice(0, Math.max(1, limit))
      .map((run) => structuredClone(run));
  }
