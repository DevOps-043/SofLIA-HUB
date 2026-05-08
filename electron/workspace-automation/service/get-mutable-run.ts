import type { WorkspaceAutomationService } from '../../workspace-automation-service.ts';
import type { WorkflowRunRecord } from '../types';

export function getMutableRun(this: WorkspaceAutomationService, runId: string): WorkflowRunRecord {
    const run = this.state.runs.find((candidate) => candidate.id === runId);
    if (!run) {
      throw new Error('No encontre el workflow solicitado.');
    }
    return run;
  }
