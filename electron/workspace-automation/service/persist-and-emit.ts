import type { WorkspaceAutomationService } from '../../workspace-automation-service.ts';
import type { WorkflowRunRecord } from '../types';

export function persistAndEmit(this: WorkspaceAutomationService, run: WorkflowRunRecord): void {
    run.updatedAt = new Date().toISOString();
    this.saveState();
    this.emit('run-updated', structuredClone(run));
  }
