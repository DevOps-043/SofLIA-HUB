import type { WorkspaceAutomationService } from '../../workspace-automation-service.ts';
import type { WorkflowRunRecord } from '../types';

export function appendLog(this: WorkspaceAutomationService, run: WorkflowRunRecord, level: 'info' | 'error', message: string): void {
    run.logs.unshift({
      at: new Date().toISOString(),
      level,
      message,
    });
    run.logs = run.logs.slice(0, 50);
  }
